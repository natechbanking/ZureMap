import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Annotation, DrawingTool, EdgeMode, EdgeRouting, StrokeStyle } from '../../../core/models/annotation.model';
import { DiagramEdge } from '../../../core/models/diagram-edge.model';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import {
  diamondPointsFromRect as diamondPointsFromRectUtil,
  edgePolylinePoints,
  linePointsFromAnnotation,
  linePointsFromCoords as linePointsFromCoordsUtil,
  polylinePointsString,
  sloppyFilterForLevel,
  strokeDashArrayForStyle,
} from '../canvas-geometry.util';

@Component({
  // Attribute selector is intentional: this component is mounted on a <g> inside <svg>.
  selector: '[appCanvasSvgLayer]', // eslint-disable-line @angular-eslint/component-selector
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-svg-layer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasSvgLayerComponent implements OnChanges {
  @Input() visibleEdges: DiagramEdge[] = [];
  @Input() annotations: Annotation[] = [];
  @Input() visibleNodes: DiagramNode[] = [];
  @Input() selectedEdgeId: string | null = null;
  @Input() selectedAnnotationId: string | null = null;
  @Input() activeTool: DrawingTool = 'pointer';
  @Input() zoomLevel = 1;
  @Input() activeColor = '#1e1e1e';
  @Input() activeStrokeWidth = 2;
  @Input() activeStrokeStyle: StrokeStyle = 'solid';
  @Input() activeSloppiness = 0;
  @Input() activeEdgeRouting: EdgeRouting = 'straight';
  @Input() activeEdgeMode: EdgeMode = 'none';
  @Input() activeFill = 'none';
  @Input() activeFillOpacity = 0.2;
  @Input() previewPath = '';
  @Input() previewArrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
  @Input() previewLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  @Input() previewRect: { x: number; y: number; w: number; h: number } | null = null;
  @Input() previewDiamond: { x: number; y: number; w: number; h: number } | null = null;
  @Input() previewEllipse: { cx: number; cy: number; rx: number; ry: number } | null = null;

  @Output() edgeClicked = new EventEmitter<{ event: MouseEvent; edge: DiagramEdge }>();
  @Output() edgeWaypointMouseDown = new EventEmitter<{ event: MouseEvent; edge: DiagramEdge; index: number }>();
  @Output() edgeMidpointMouseDown = new EventEmitter<{ event: MouseEvent; edge: DiagramEdge; segmentIndex: number }>();
  @Output() edgeWaypointDblClick = new EventEmitter<{ event: MouseEvent; edge: DiagramEdge; index: number }>();
  @Output() annotationMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() annotationContextMenu = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() annWaypointMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation; index: number }>();
  @Output() annMidpointMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation; segmentIndex: number }>();
  @Output() annWaypointDblClick = new EventEmitter<{ event: MouseEvent; ann: Annotation; index: number }>();
  @Output() annotationShapeResizeMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation; handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w' }>();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private nodeMap = new Map<string, DiagramNode>();
  private annotationMap = new Map<string, Annotation>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visibleNodes']) {
      this.nodeMap = new Map(this.visibleNodes.map(n => [n.id, n]));
    }
    if (changes['annotations']) {
      this.annotationMap = new Map(this.annotations.map(a => [a.id, a]));
    }
  }

  // ── Edge geometry ──────────────────────────────────────────────────────────

  getEdgePoints(edge: DiagramEdge): { x: number; y: number }[] {
    return edgePolylinePoints(this.visibleNodes, edge, this.nodeMap, this.annotationMap);
  }

  getEdgePolylineString(edge: DiagramEdge): string {
    return polylinePointsString(this.getEdgePoints(edge));
  }

  getEdgeHandles(edge: DiagramEdge): { x: number; y: number; index: number }[] {
    return (edge.waypoints ?? []).map((wp, i) => ({ x: wp.x, y: wp.y, index: i }));
  }

  getEdgeMidHandles(edge: DiagramEdge): { x: number; y: number; segmentIndex: number }[] {
    const pts = this.getEdgePoints(edge);
    const mids: { x: number; y: number; segmentIndex: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      mids.push({ x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2, segmentIndex: i });
    }
    return mids;
  }

  // ── Annotation geometry ────────────────────────────────────────────────────

  getAnnHandles(ann: Annotation): { x: number; y: number; index: number }[] {
    return (ann.waypoints ?? []).map((wp, i) => ({ x: wp.x, y: wp.y, index: i }));
  }

  getAnnMidHandles(ann: Annotation): { x: number; y: number; segmentIndex: number }[] {
    const pts: { x: number; y: number }[] = [
      { x: ann.x, y: ann.y },
      ...(ann.waypoints ?? []),
      { x: ann.x2 ?? ann.x, y: ann.y2 ?? ann.y },
    ];
    const mids: { x: number; y: number; segmentIndex: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      mids.push({ x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2, segmentIndex: i });
    }
    return mids;
  }

  linePoints(ann: Annotation): string {
    return linePointsFromAnnotation(ann);
  }

  linePointsFromCoords(x1: number, y1: number, x2: number, y2: number, routing: EdgeRouting): string {
    return linePointsFromCoordsUtil(x1, y1, x2, y2, routing);
  }

  diamondPoints(ann: Annotation): string {
    if (!ann.width || !ann.height) return '';
    return diamondPointsFromRectUtil({ x: ann.x, y: ann.y, w: ann.width, h: ann.height });
  }

  diamondPointsFromRect(r: { x: number; y: number; w: number; h: number }): string {
    return diamondPointsFromRectUtil(r);
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  strokeDashArray(ann?: Annotation, styleOverride?: StrokeStyle): string | null {
    const style = styleOverride ?? ann?.strokeStyle ?? 'solid';
    return strokeDashArrayForStyle(style);
  }

  sloppyFilter(ann?: Annotation, sloppinessOverride?: number): string | null {
    const level = Math.max(0, Math.min(3, Math.round(sloppinessOverride ?? ann?.sloppiness ?? 0)));
    return sloppyFilterForLevel(level);
  }

  // ── Marker helpers ─────────────────────────────────────────────────────────

  edgeMarkerId(color: string): string {
    return `edge-arrow-${color.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  edgeMarkerUrl(color: string): string {
    return `url(#${this.edgeMarkerId(color)})`;
  }

  annMarkerId(color: string): string {
    return `ann-arrow-${color.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  annMarkerUrl(color: string): string {
    return `url(#${this.annMarkerId(color)})`;
  }

  markerStart(ann: Annotation): string | null {
    const mode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
    return mode === 'start' || mode === 'both' ? this.annMarkerUrl(ann.color) : null;
  }

  markerEnd(ann: Annotation): string | null {
    const mode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
    return mode === 'end' || mode === 'both' ? this.annMarkerUrl(ann.color) : null;
  }

  previewMarkerStart(): string | null {
    return this.activeEdgeMode === 'start' || this.activeEdgeMode === 'both' ? this.annMarkerUrl(this.activeColor) : null;
  }

  previewMarkerEnd(): string | null {
    return this.activeEdgeMode === 'end' || this.activeEdgeMode === 'both' ? this.annMarkerUrl(this.activeColor) : null;
  }
}
