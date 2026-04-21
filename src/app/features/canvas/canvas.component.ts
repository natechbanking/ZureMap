import { Component, inject, effect, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { ExportService } from '../../core/services/export.service';
import { DriftService } from '../../core/services/drift.service';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import { DiagramNodeComponent, ContextMenuRequest, InternalItemMoveRequest } from './diagram-node/diagram-node.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { DrawingToolbarComponent } from './drawing-toolbar/drawing-toolbar.component';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { Annotation, DrawingTool, StrokeStyle, EdgeRouting, EdgeMode } from '../../core/models/annotation.model';
import { DiagramEdge, EdgeStyle } from '../../core/models/diagram-edge.model';
import { RgBound, SubscriptionBound, VmBound, RouteTableBound, ResourceEditorDraft } from './canvas.types';
import { CanvasEdgeEditorService } from './canvas-edge-editor.service';
import { CanvasResourceEditorService } from './canvas-resource-editor.service';
import { CanvasFinopsService } from './canvas-finops.service';
import {
  diamondPointsFromRect as diamondPointsFromRectUtil,
  edgeAnchorBetween,
  linePointsFromAnnotation,
  linePointsFromCoords as linePointsFromCoordsUtil,
  sloppyFilterForLevel,
  strokeDashArrayForStyle,
} from './canvas-geometry.util';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, DiagramNodeComponent, SidebarComponent, ToolbarComponent, DrawingToolbarComponent],
  templateUrl: "./canvas.component.html",
  styleUrl: "./canvas.component.scss",
})
export class CanvasComponent {
  @ViewChild('canvasHost', { read: ElementRef }) canvasHostRef!: ElementRef;
  @ViewChild('editTextarea') editTextareaRef?: ElementRef;
  @ViewChild('renameInput') renameInputRef?: ElementRef;

  store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  private exportSvc = inject(ExportService);
  private driftSvc = inject(DriftService);
  private edgeEditor = inject(CanvasEdgeEditorService);
  private resourceEditor = inject(CanvasResourceEditorService);
  private finops = inject(CanvasFinopsService);
  private router = inject(Router);
  readonly rgIconUrl = inject(IconRegistryService).getIconUrl('microsoft.resources/resourcegroups');
  readonly subscriptionIconUrl = inject(IconRegistryService).getIconUrl('microsoft.resources/subscriptions');

  // ── Layout ─────────────────────────────────────────────────────────────────
  private readonly ZOOM_MIN = 0.4;
  private readonly ZOOM_MAX = 2.5;
  private readonly ZOOM_STEP = 0.1;

  visibleNodes: DiagramNode[] = [];
  visibleEdges = this.store.edges();
  subscriptionBounds: SubscriptionBound[] = [];
  rgBounds: RgBound[] = [];
  vmBounds: VmBound[] = [];
  routeTableBounds: RouteTableBound[] = [];
  private rgDragStart = { clientX: 0, clientY: 0 };
  private collapsedResourceGroups = new Set<string>();
  private collapsedSubscriptions = new Set<string>();
  private collapsedVmGroups = new Set<string>();
  private collapsedRouteTableGroups = new Set<string>();
  private isResolvingSubscriptionOverlaps = false;

  constructor() {
    effect(() => {
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      this.refreshVisibility(nodes, edges);
    });
  }

  // ── Drawing tool state ─────────────────────────────────────────────────────
  activeTool: DrawingTool = 'pointer';
  activeColor = '#1e1e1e';
  activeStrokeWidth = 2;
  activeStrokeStyle: StrokeStyle = 'solid';
  activeSloppiness = 0;
  activeEdgeRouting: EdgeRouting = 'straight';
  activeEdgeMode: EdgeMode = 'end';
  activeFill = 'none';
  activeFillOpacity = 0.2;

  selectedAnnotationId: string | null = null;
  editingAnnotation: Annotation | null = null;
  editingTextValue = '';

  // In-progress drawing previews
  previewPath = '';
  previewArrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewRect: { x: number; y: number; w: number; h: number } | null = null;
  previewDiamond: { x: number; y: number; w: number; h: number } | null = null;
  previewEllipse: { cx: number; cy: number; rx: number; ry: number } | null = null;

  // Internal drawing state
  private isDrawing = false;
  private drawPoints: Array<[number, number]> = [];
  private shapeStart: { x: number; y: number } | null = null;

  // Annotation drag state
  private annDragId: string | null = null;
  private annDragMouse = { x: 0, y: 0 };
  private annDragOrigin: { x: number; y: number; x2?: number; y2?: number } = { x: 0, y: 0 };

  // RG mouse drag (smooth, incremental)
  rgDragState: { id: string; lastX: number; lastY: number } | null = null;
  get isRgDragging(): boolean { return this.rgDragState !== null; }
  subscriptionDragState: { subscriptionId: string; lastX: number; lastY: number } | null = null;
  get isSubscriptionDragging(): boolean { return this.subscriptionDragState !== null; }
  vmDragState: { vmId: string; lastX: number; lastY: number } | null = null;
  get isVmDragging(): boolean { return this.vmDragState !== null; }

  // Individual node mouse drag
  nodeDragState: { id: string; lastX: number; lastY: number; hasMoved: boolean } | null = null;

  // Context menu
  contextMenu: (ContextMenuRequest & { node: DiagramNode }) | null = null;

  // Container rename
  customContainerNames = new Map<string, string>();
  renamingContainer: { type: 'rg' | 'sub' | 'vm' | 'rt'; id: string } | null = null;
  renamingValue = '';

  // Floating toolbar drag
  toolbarPos = { x: 12, y: 12 };
  toolbarDragState: { lastX: number; lastY: number } | null = null;

  // Node HTML5 drag
  private dragOffset = { x: 0, y: 0 };
  selectedEdgeId: string | null = null;
  resourceEditorOpen = false;
  resourceEditorNodeId: string | null = null;
  resourceEditorDraft: ResourceEditorDraft | null = null;
  finOpsLoading = false;
  finOpsError: string | null = null;
  finOpsLoadedSubscriptions = 0;

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && this.selectedAnnotationId) {
      e.preventDefault();
      this.duplicateSelectedAnnotation();
      return;
    }
    if (e.key === ']' && this.selectedAnnotationId) {
      e.preventDefault();
      this.bringSelectedAnnotationToFront();
      return;
    }
    if (e.key === '[' && this.selectedAnnotationId) {
      e.preventDefault();
      this.sendSelectedAnnotationToBack();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedAnnotationId) {
      this.deleteSelectedAnnotation();
    }
    if (e.key === 'Escape') {
      this.closeContextMenu();
      this.cancelRename();
      this.selectedAnnotationId = null;
      if (this.editingAnnotation) this.cancelEdit();
    }
  }

  // ── Document-level mouse events (for drag completion outside SVG) ──────────
  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(e: MouseEvent): void {
    // Toolbar drag
    if (this.toolbarDragState) {
      const dx = e.clientX - this.toolbarDragState.lastX;
      const dy = e.clientY - this.toolbarDragState.lastY;
      this.toolbarPos = { x: Math.max(0, this.toolbarPos.x + dx), y: Math.max(0, this.toolbarPos.y + dy) };
      this.toolbarDragState.lastX = e.clientX;
      this.toolbarDragState.lastY = e.clientY;
      return;
    }

    // Individual node drag — incremental delta, pins the node on first move
    if (this.nodeDragState) {
      const dx = (e.clientX - this.nodeDragState.lastX) / this.zoomLevel;
      const dy = (e.clientY - this.nodeDragState.lastY) / this.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        if (!this.nodeDragState.hasMoved) {
          this.store.pinNode(this.nodeDragState.id);
          this.nodeDragState.hasMoved = true;
        }
        const node = this.store.nodes().find(n => n.id === this.nodeDragState!.id);
        if (node) {
          this.store.moveNode(node.id, {
            x: Math.max(0, node.position.x + dx),
            y: Math.max(0, node.position.y + dy),
          });
        }
        this.nodeDragState.lastX = e.clientX;
        this.nodeDragState.lastY = e.clientY;
      }
      return;
    }

    // Subscription group drag — moves all nodes in the subscription together
    if (this.subscriptionDragState) {
      const dx = (e.clientX - this.subscriptionDragState.lastX) / this.zoomLevel;
      const dy = (e.clientY - this.subscriptionDragState.lastY) / this.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        this.store.moveSubscriptionGroup(this.subscriptionDragState.subscriptionId, { dx, dy });
        this.subscriptionDragState.lastX = e.clientX;
        this.subscriptionDragState.lastY = e.clientY;
      }
      return;
    }

    // VM group drag — moves VM and its related components together
    if (this.vmDragState) {
      const dx = (e.clientX - this.vmDragState.lastX) / this.zoomLevel;
      const dy = (e.clientY - this.vmDragState.lastY) / this.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        this.store.moveVmGroup(this.vmDragState.vmId, { dx, dy });
        this.vmDragState.lastX = e.clientX;
        this.vmDragState.lastY = e.clientY;
      }
      return;
    }

    // RG group drag — incremental delta so position tracks the cursor exactly
    if (this.rgDragState) {
      const dx = (e.clientX - this.rgDragState.lastX) / this.zoomLevel;
      const dy = (e.clientY - this.rgDragState.lastY) / this.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        this.store.moveNodeGroup(this.rgDragState.id, { dx, dy });
        this.rgDragState.lastX = e.clientX;
        this.rgDragState.lastY = e.clientY;
      }
      return;
    }

    // Annotation drag
    if (this.annDragId) {
      const pt = this.svgPoint(e);
      const dx = pt.x - this.annDragMouse.x;
      const dy = pt.y - this.annDragMouse.y;
      const { x2, y2 } = this.annDragOrigin;
      this.store.updateAnnotation(this.annDragId, {
        x: this.annDragOrigin.x + dx,
        y: this.annDragOrigin.y + dy,
        x2: typeof x2 === 'number' ? x2 + dx : undefined,
        y2: typeof y2 === 'number' ? y2 + dy : undefined,
      });
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? this.ZOOM_STEP : -this.ZOOM_STEP;
    this.setZoom(this.zoomLevel + delta, { x: event.clientX, y: event.clientY });
  }

  @HostListener('document:mouseup')
  onDocMouseUp(): void {
    this.toolbarDragState = null;
    this.subscriptionDragState = null;
    this.vmDragState = null;
    this.rgDragState = null;
    this.nodeDragState = null;
    this.annDragId = null;
  }

  // ── Tool management ────────────────────────────────────────────────────────
  setTool(tool: DrawingTool): void {
    this.activeTool = tool;
    this.selectedAnnotationId = null;
    this.selectedEdgeId = null;
    this.clearPreviews();
    this.isDrawing = false;
    this.drawPoints = [];
    this.shapeStart = null;
  }

  // ── Drawing surface events ─────────────────────────────────────────────────
  onDrawMouseDown(e: MouseEvent): void {
    e.preventDefault();
    const pt = this.svgPoint(e);

    if (this.activeTool === 'text' || this.activeTool === 'sticky') {
      const ann = this.newAnnotation('text', pt.x, pt.y);
      if (this.activeTool === 'sticky') ann.type = 'sticky';
      this.store.addAnnotation(ann);
      this.startEditAnnotation(ann);
      return;
    }

    this.isDrawing = true;
    if (this.activeTool === 'draw') {
      this.drawPoints = [[pt.x, pt.y]];
      this.previewPath = `M ${pt.x} ${pt.y}`;
    } else {
      this.shapeStart = pt;
    }
  }

  onDrawMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const pt = this.svgPoint(e);

    if (this.activeTool === 'draw') {
      this.drawPoints.push([pt.x, pt.y]);
      this.previewPath = this.buildSmoothPath(this.drawPoints);
    } else if (this.shapeStart) {
      const s = this.shapeStart;
      if (this.activeTool === 'arrow') {
        this.previewArrow = { x1: s.x, y1: s.y, x2: pt.x, y2: pt.y };
      } else if (this.activeTool === 'line') {
        this.previewLine = { x1: s.x, y1: s.y, x2: pt.x, y2: pt.y };
      } else if (this.activeTool === 'rect') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        this.previewRect = r;
      } else if (this.activeTool === 'diamond') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        this.previewDiamond = r;
      } else if (this.activeTool === 'ellipse') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        this.previewEllipse = { cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 };
      }
    }
  }

  onDrawMouseUp(e: MouseEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const pt = this.svgPoint(e);

    if (this.activeTool === 'draw' && this.drawPoints.length > 1) {
      this.store.addAnnotation({ ...this.newAnnotation('draw', 0, 0), pathData: this.buildSmoothPath(this.drawPoints) });
    } else if (this.shapeStart) {
      const s = this.shapeStart;
      if (this.activeTool === 'arrow') {
        const dx = pt.x - s.x; const dy = pt.y - s.y;
        if (Math.hypot(dx, dy) > 5) {
          this.store.addAnnotation({ ...this.newAnnotation('arrow', s.x, s.y), x2: pt.x, y2: pt.y });
        }
      } else if (this.activeTool === 'line') {
        const dx = pt.x - s.x; const dy = pt.y - s.y;
        if (Math.hypot(dx, dy) > 5) {
          this.store.addAnnotation({ ...this.newAnnotation('line', s.x, s.y), x2: pt.x, y2: pt.y });
        }
      } else if (this.activeTool === 'rect') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        if (r.w > 4 && r.h > 4) {
          this.store.addAnnotation({ ...this.newAnnotation('rect', r.x, r.y), width: r.w, height: r.h, fill: this.activeFill });
        }
      } else if (this.activeTool === 'diamond') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        if (r.w > 4 && r.h > 4) {
          this.store.addAnnotation({ ...this.newAnnotation('diamond', r.x, r.y), width: r.w, height: r.h, fill: this.activeFill });
        }
      } else if (this.activeTool === 'ellipse') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        if (r.w > 4 && r.h > 4) {
          this.store.addAnnotation({ ...this.newAnnotation('ellipse', r.x, r.y), width: r.w, height: r.h, fill: this.activeFill });
        }
      }
    }

    this.drawPoints = [];
    this.shapeStart = null;
    this.clearPreviews();
  }

  // ── Annotation interaction ─────────────────────────────────────────────────
  onAnnotationMouseDown(e: MouseEvent, ann: Annotation): void {
    if (this.activeTool !== 'pointer') return;
    e.stopPropagation();
    this.selectedEdgeId = null;
    this.selectedAnnotationId = ann.id;
    const pt = this.svgPoint(e);
    this.annDragId = ann.id;
    this.annDragMouse = { x: pt.x, y: pt.y };
    this.annDragOrigin = { x: ann.x, y: ann.y, x2: ann.x2, y2: ann.y2 };
  }

  startEditAnnotation(ann: Annotation): void {
    this.editingAnnotation = ann;
    this.editingTextValue = ann.text ?? '';
    setTimeout(() => this.editTextareaRef?.nativeElement?.focus(), 0);
  }

  finishEdit(): void {
    if (!this.editingAnnotation) return;
    const text = this.editingTextValue.trim();
    if (text) {
      this.store.updateAnnotation(this.editingAnnotation.id, { text });
    } else {
      this.store.deleteAnnotation(this.editingAnnotation.id);
    }
    this.editingAnnotation = null;
    this.editingTextValue = '';
  }

  cancelEdit(): void {
    if (this.editingAnnotation && !this.editingAnnotation.text) {
      this.store.deleteAnnotation(this.editingAnnotation.id);
    }
    this.editingAnnotation = null;
    this.editingTextValue = '';
  }

  onEditKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
    if (e.key === 'Enter' && !e.shiftKey && this.editingAnnotation?.type === 'text') {
      e.preventDefault(); this.finishEdit();
    }
  }

  deleteSelectedAnnotation(): void {
    if (this.selectedAnnotationId) {
      this.store.deleteAnnotation(this.selectedAnnotationId);
      this.selectedAnnotationId = null;
    }
  }

  duplicateSelectedAnnotation(): void {
    if (!this.selectedAnnotationId) return;
    const source = this.annotationById(this.selectedAnnotationId);
    if (!source) return;
    const duplicated: Annotation = {
      ...source,
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: source.x + 20,
      y: source.y + 20,
      x2: source.x2 !== undefined ? source.x2 + 20 : undefined,
      y2: source.y2 !== undefined ? source.y2 + 20 : undefined,
    };
    this.store.addAnnotation(duplicated);
    this.selectedAnnotationId = duplicated.id;
  }

  bringSelectedAnnotationToFront(): void {
    if (!this.selectedAnnotationId) return;
    this.store.annotations.update(list => {
      const idx = list.findIndex(a => a.id === this.selectedAnnotationId);
      if (idx < 0 || idx === list.length - 1) return list;
      const picked = list[idx];
      return [...list.slice(0, idx), ...list.slice(idx + 1), picked];
    });
  }

  sendSelectedAnnotationToBack(): void {
    if (!this.selectedAnnotationId) return;
    this.store.annotations.update(list => {
      const idx = list.findIndex(a => a.id === this.selectedAnnotationId);
      if (idx <= 0) return list;
      const picked = list[idx];
      return [picked, ...list.slice(0, idx), ...list.slice(idx + 1)];
    });
  }

  clearAllAnnotations(): void {
    if (this.store.annotations().length === 0) return;
    const shouldClear = confirm('Clear all annotations from this diagram?');
    if (!shouldClear) return;
    this.store.clearAnnotations();
    this.selectedAnnotationId = null;
    this.editingAnnotation = null;
    this.editingTextValue = '';
  }

  // ── Annotation helpers ─────────────────────────────────────────────────────
  annotationById(id: string): Annotation | undefined {
    return this.store.annotations().find(a => a.id === id);
  }

  annDeleteBtnX(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') return Math.max(ann.x, ann.x2 ?? ann.x) + 8;
    return ann.x + (ann.width ?? 120) + 4;
  }

  annDeleteBtnY(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') return Math.min(ann.y, ann.y2 ?? ann.y) - 10;
    return ann.y - 10;
  }

  diamondPoints(ann: Annotation): string {
    if (!ann.width || !ann.height) return '';
    return diamondPointsFromRectUtil({ x: ann.x, y: ann.y, w: ann.width, h: ann.height });
  }

  diamondPointsFromRect(r: { x: number; y: number; w: number; h: number }): string {
    return diamondPointsFromRectUtil(r);
  }

  linePoints(ann: Annotation): string {
    return linePointsFromAnnotation(ann);
  }

  linePointsFromCoords(x1: number, y1: number, x2: number, y2: number, routing: EdgeRouting): string {
    return linePointsFromCoordsUtil(x1, y1, x2, y2, routing);
  }

  strokeDashArray(ann?: Annotation, styleOverride?: StrokeStyle): string | null {
    const style = styleOverride ?? ann?.strokeStyle ?? 'solid';
    return strokeDashArrayForStyle(style);
  }

  sloppyFilter(ann?: Annotation, sloppinessOverride?: number): string | null {
    const level = Math.max(0, Math.min(3, Math.round(sloppinessOverride ?? ann?.sloppiness ?? 0)));
    return sloppyFilterForLevel(level);
  }

  markerStart(ann: Annotation): string | null {
    const mode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
    return mode === 'start' || mode === 'both' ? 'url(#ann-arrow)' : null;
  }

  markerEnd(ann: Annotation): string | null {
    const mode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
    return mode === 'end' || mode === 'both' ? 'url(#ann-arrow)' : null;
  }

  previewMarkerStart(): string | null {
    return this.activeEdgeMode === 'start' || this.activeEdgeMode === 'both' ? 'url(#ann-arrow)' : null;
  }

  previewMarkerEnd(): string | null {
    return this.activeEdgeMode === 'end' || this.activeEdgeMode === 'both' ? 'url(#ann-arrow)' : null;
  }

  arrowHead(x1: number, y1: number, x2: number, y2: number): string {
    const L = 12; const W = 5;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const p1x = x2 - L * Math.cos(angle) + W * Math.sin(angle);
    const p1y = y2 - L * Math.sin(angle) - W * Math.cos(angle);
    const p2x = x2 - L * Math.cos(angle) - W * Math.sin(angle);
    const p2y = y2 - L * Math.sin(angle) + W * Math.cos(angle);
    return `M ${x2} ${y2} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`;
  }

  // ── Canvas size ────────────────────────────────────────────────────────────
  get canvasWidth(): number {
    const nodes = this.store.nodes();
    const anns = this.store.annotations();
    return Math.max(1200,
      ...nodes.map(n => n.position.x + n.size.width + 80),
      ...anns.map(a => Math.max(a.x + (a.width ?? 200) + 80, (a.x2 ?? 0) + 80)),
    );
  }

  get canvasHeight(): number {
    const nodes = this.store.nodes();
    const anns = this.store.annotations();
    return Math.max(800,
      ...nodes.map(n => n.position.y + n.size.height + 80),
      ...anns.map(a => Math.max(a.y + (a.height ?? 80) + 80, (a.y2 ?? 0) + 80)),
    );
  }

  // ── RG boxes ───────────────────────────────────────────────────────────────
  private computeRgBounds(nodes: DiagramNode[]): RgBound[] {
    const PAD = 28; const LABEL_H = 28;
    const map = new Map<string, { subscriptionId: string; name: string; nodes: DiagramNode[] }>();
    for (const n of nodes) {
      const rg = n.metadata?.resourceGroup || n.groupId || '';
      const subscriptionId = n.metadata?.subscriptionId || '';
      if (!rg) continue;
      const id = `${subscriptionId}::${rg}`;
      if (!map.has(id)) map.set(id, { subscriptionId, name: rg, nodes: [] });
      map.get(id)!.nodes.push(n);
    }
    return Array.from(map.entries()).map(([id, entry]) => {
      const { subscriptionId, nodes: rgNodes } = entry;
      const name = this.customContainerNames.get(`rg::${id}`) ?? entry.name;
      const xMin = Math.min(...rgNodes.map(n => n.position.x));
      const yMin = Math.min(...rgNodes.map(n => n.position.y));
      const xMax = Math.max(...rgNodes.map(n => n.position.x + n.size.width));
      const yMax = Math.max(...rgNodes.map(n => n.position.y + n.size.height));
      const collapsed = this.collapsedResourceGroups.has(id);

      return {
        id,
        subscriptionId,
        name,
        collapsed,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        width: collapsed ? Math.max(220, Math.ceil(name.length * 7.5) + 72) : xMax + PAD - (xMin - PAD),
        height: collapsed ? LABEL_H + 8 : yMax + PAD - (yMin - PAD - LABEL_H),
      };
    });
  }

  private computeSubscriptionBounds(rgBounds: RgBound[], nodes: DiagramNode[]): SubscriptionBound[] {
    const activeSubCount = this.store.activeSubscriptions().length;
    const nodeSubCount = new Set(nodes.map(n => n.metadata?.subscriptionId).filter(Boolean)).size;
    if (activeSubCount <= 1 && nodeSubCount <= 1) return [];

    const PAD = 24;
    const LABEL_H = 32;
    const nameBySubscriptionId = new Map(
      this.store.activeSubscriptions().map(s => [s.subscriptionId, s.name]),
    );
    const map = new Map<string, RgBound[]>();
    for (const bound of rgBounds) {
      if (!map.has(bound.subscriptionId)) map.set(bound.subscriptionId, []);
      map.get(bound.subscriptionId)!.push(bound);
    }

    return Array.from(map.entries()).map(([subscriptionId, groups]) => {
      const xMin = Math.min(...groups.map(g => g.x));
      const yMin = Math.min(...groups.map(g => g.y));
      const xMax = Math.max(...groups.map(g => g.x + g.width));
      const yMax = Math.max(...groups.map(g => g.y + g.height));
      const collapsed = this.collapsedSubscriptions.has(subscriptionId);

      const defaultSubName = nameBySubscriptionId.get(subscriptionId) || subscriptionId || 'Unknown subscription';
      return {
        id: subscriptionId || '__unknown-subscription__',
        subscriptionId,
        name: this.customContainerNames.get(`sub::${subscriptionId}`) ?? defaultSubName,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        collapsed,
        width: collapsed ? Math.max(320, Math.ceil(defaultSubName.length * 7.5) + 96) : xMax - xMin + PAD * 2,
        height: collapsed ? LABEL_H + 12 : yMax - yMin + PAD * 2 + LABEL_H,
      };
    });
  }

  private computeVmBounds(nodes: DiagramNode[]): VmBound[] {
    const PAD = 14;
    const LABEL_H = 20;
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const bounds: VmBound[] = [];

    for (const vm of nodes) {
      if (vm.resourceType !== 'microsoft.compute/virtualmachines') continue;
      if (!vm.children?.length) continue;

      const members: DiagramNode[] = [vm];
      for (const childId of vm.children) {
        const child = nodeById.get(childId);
        if (child) members.push(child);
      }

      if (members.length < 2) continue;

      const xMin = Math.min(...members.map(n => n.position.x));
      const yMin = Math.min(...members.map(n => n.position.y));
      const xMax = Math.max(...members.map(n => n.position.x + n.size.width));
      const yMax = Math.max(...members.map(n => n.position.y + n.size.height));
      const collapsed = this.collapsedVmGroups.has(vm.id);
      const vmName = this.customContainerNames.get(`vm::${vm.id}`) ?? vm.label;

      bounds.push({
        id: vm.id,
        name: vmName,
        collapsed,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        width: collapsed ? Math.max(220, Math.ceil(vm.label.length * 7.5) + 88) : xMax + PAD - (xMin - PAD),
        height: collapsed ? LABEL_H + 10 : yMax + PAD - (yMin - PAD - LABEL_H),
      });
    }

    return bounds;
  }

  private computeRouteTableBounds(nodes: DiagramNode[]): RouteTableBound[] {
    const PAD = 12;
    const LABEL_H = 20;
    const GAP_BELOW_PARENT = 6;
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const bounds: RouteTableBound[] = [];

    for (const routeTable of nodes) {
      if (routeTable.resourceType !== 'microsoft.network/routetables') continue;

      const routeNodes = (routeTable.children ?? [])
        .map(id => nodeById.get(id))
        .filter((n): n is DiagramNode => !!n && n.resourceType === 'microsoft.network/routetables/routes');
      if (routeNodes.length === 0) continue;

      const collapsed = this.collapsedRouteTableGroups.has(routeTable.id);
      const rtName = this.customContainerNames.get(`rt::${routeTable.id}`) ?? routeTable.label;
      const tableBottom = routeTable.position.y + routeTable.size.height;
      const yStart = tableBottom + GAP_BELOW_PARENT;
      const childBottom = Math.max(yStart, ...routeNodes.map(n => n.position.y + n.size.height));

      const xMin = Math.min(routeTable.position.x, ...routeNodes.map(n => n.position.x));
      const xMax = Math.max(routeTable.position.x + routeTable.size.width, ...routeNodes.map(n => n.position.x + n.size.width));

      bounds.push({
        id: routeTable.id,
        name: rtName,
        collapsed,
        x: xMin - PAD,
        y: yStart,
        width: collapsed ? Math.max(220, Math.ceil(routeTable.label.length * 7.5) + 88) : xMax - xMin + PAD * 2,
        height: collapsed ? LABEL_H + 10 : Math.max(LABEL_H + 10, childBottom - yStart + PAD),
      });
    }

    return bounds;
  }

  toggleSubscriptionCollapsed(subscriptionId: string): void {
    if (this.collapsedSubscriptions.has(subscriptionId)) {
      this.collapsedSubscriptions.delete(subscriptionId);
    } else {
      this.collapsedSubscriptions.add(subscriptionId);
      const selectedNode = this.store.selectedNode();
      if (selectedNode && (selectedNode.metadata?.subscriptionId || '') === subscriptionId) {
        this.store.selectNode(null);
      }
    }

    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleRgCollapsed(rgId: string): void {
    if (this.collapsedResourceGroups.has(rgId)) {
      this.collapsedResourceGroups.delete(rgId);
    } else {
      this.collapsedResourceGroups.add(rgId);
      const selectedNode = this.store.selectedNode();
      const selectedRgId = `${selectedNode?.metadata?.subscriptionId || ''}::${selectedNode?.metadata?.resourceGroup || selectedNode?.groupId || ''}`;
      if (selectedNode && selectedRgId === rgId) {
        this.store.selectNode(null);
      }
    }

    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleVmCollapsed(vmId: string): void {
    if (this.collapsedVmGroups.has(vmId)) {
      this.collapsedVmGroups.delete(vmId);
    } else {
      this.collapsedVmGroups.add(vmId);
      const selectedNode = this.store.selectedNode();
      const vmNode = this.store.nodes().find(n => n.id === vmId);
      const selectedInVm = !!selectedNode && !!vmNode && (selectedNode.id === vmId || (vmNode.children ?? []).includes(selectedNode.id));
      if (selectedInVm) {
        this.store.selectNode(null);
      }
    }

    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleRouteTableCollapsed(routeTableId: string): void {
    if (this.collapsedRouteTableGroups.has(routeTableId)) {
      this.collapsedRouteTableGroups.delete(routeTableId);
    } else {
      this.collapsedRouteTableGroups.add(routeTableId);
      const selectedNode = this.store.selectedNode();
      const rtNode = this.store.nodes().find(n => n.id === routeTableId);
      const selectedInRt = !!selectedNode && !!rtNode
        && (selectedNode.id === routeTableId || (rtNode.children ?? []).includes(selectedNode.id));
      if (selectedInRt) {
        this.store.selectNode(null);
      }
    }

    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  private refreshVisibility(nodes: DiagramNode[], edges: ReturnType<DiagramStore['edges']>): void {
    const isVisibleBySubscription = (n: DiagramNode) => {
      const subscriptionId = n.metadata?.subscriptionId || '';
      return !this.collapsedSubscriptions.has(subscriptionId);
    };

    const baseVisibleNodes = nodes.filter(n => {
      if (!isVisibleBySubscription(n)) return false;
      const rg = n.metadata?.resourceGroup || n.groupId || '';
      const subscriptionId = n.metadata?.subscriptionId || '';
      return !this.collapsedResourceGroups.has(`${subscriptionId}::${rg}`);
    });

    const hiddenByVmCollapse = new Set<string>();
    const baseById = new Map(baseVisibleNodes.map(n => [n.id, n]));
    for (const vmId of this.collapsedVmGroups) {
      const vm = baseById.get(vmId);
      if (!vm) continue;
      for (const childId of vm.children ?? []) hiddenByVmCollapse.add(childId);
    }

    const hiddenByRouteTableCollapse = new Set<string>();
    for (const routeTableId of this.collapsedRouteTableGroups) {
      const routeTable = baseById.get(routeTableId);
      if (!routeTable) continue;
      for (const childId of routeTable.children ?? []) {
        const child = baseById.get(childId);
        if (child?.resourceType === 'microsoft.network/routetables/routes') {
          hiddenByRouteTableCollapse.add(childId);
        }
      }
    }

    this.visibleNodes = baseVisibleNodes.filter(n =>
      !hiddenByVmCollapse.has(n.id) && !hiddenByRouteTableCollapse.has(n.id),
    );

    const visibleIds = new Set(this.visibleNodes.map(n => n.id));
    this.visibleEdges = edges.filter(e => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId));
    if (this.selectedEdgeId && !this.visibleEdges.some(e => e.id === this.selectedEdgeId)) {
      this.selectedEdgeId = null;
    }
    this.rgBounds = this.computeRgBounds(nodes.filter(isVisibleBySubscription));
    this.subscriptionBounds = this.computeSubscriptionBounds(this.rgBounds, nodes);
    this.vmBounds = this.computeVmBounds(baseVisibleNodes);
    this.routeTableBounds = this.computeRouteTableBounds(baseVisibleNodes);
    this.resolveSubscriptionContainerOverlaps(this.subscriptionBounds);
  }

  private resolveSubscriptionContainerOverlaps(bounds: SubscriptionBound[]): void {
    if (this.isResolvingSubscriptionOverlaps) return;
    if (bounds.length < 2) return;

    const GAP = 24;
    const MAX_ITERS = 10;
    this.isResolvingSubscriptionOverlaps = true;
    try {
      for (let iter = 0; iter < MAX_ITERS; iter++) {
        let moved = false;
        const current = this.computeSubscriptionBounds(
          this.computeRgBounds(this.store.nodes().filter(n => !this.collapsedSubscriptions.has(n.metadata?.subscriptionId || ''))),
          this.store.nodes(),
        );

        outer:
        for (let i = 0; i < current.length; i++) {
          for (let j = i + 1; j < current.length; j++) {
            const a = current[i];
            const b = current[j];
            if (!a.subscriptionId || !b.subscriptionId) continue;

            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const moveX = overlapX + GAP;
            const moveY = overlapY + GAP;

            // Push the latter container along the axis that requires less movement.
            if (moveX <= moveY) {
              this.store.moveSubscriptionGroup(b.subscriptionId, { dx: moveX, dy: 0 });
            } else {
              this.store.moveSubscriptionGroup(b.subscriptionId, { dx: 0, dy: moveY });
            }

            moved = true;
            break outer;
          }
        }

        if (!moved) break;
      }
    } finally {
      this.isResolvingSubscriptionOverlaps = false;
    }
  }

  // ── Toolbar drag ───────────────────────────────────────────────────────────
  onToolbarDragMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.toolbarDragState = { lastX: e.clientX, lastY: e.clientY };
  }

  // ── Node drag ──────────────────────────────────────────────────────────────
  onRgMouseDown(event: MouseEvent, rgId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.rgDragState = { id: rgId, lastX: event.clientX, lastY: event.clientY };
  }

  onSubscriptionMouseDown(event: MouseEvent, subscriptionId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.subscriptionDragState = { subscriptionId, lastX: event.clientX, lastY: event.clientY };
  }

  onVmMouseDown(event: MouseEvent, vmId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.vmDragState = { vmId, lastX: event.clientX, lastY: event.clientY };
  }

  onNodeMouseDown(event: MouseEvent, node: DiagramNode): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedEdgeId = null;
    this.nodeDragState = { id: node.id, lastX: event.clientX, lastY: event.clientY, hasMoved: false };
  }

  onDragStart(event: DragEvent, node: DiagramNode): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.dataTransfer!.setData('nodeId', node.id);
  }

  onDragEnd(event: DragEvent, node: DiagramNode): void {
    const canvas = this.canvasHostRef?.nativeElement as HTMLElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.dragOffset.x + canvas.scrollLeft) / this.zoomLevel;
    const y = (event.clientY - rect.top - this.dragOffset.y + canvas.scrollTop) / this.zoomLevel;
    this.store.moveNode(node.id, { x: Math.max(0, x), y: Math.max(0, y) });
  }

  get zoomLevel(): number {
    return this.store.zoomLevel();
  }

  get zoomPercent(): number {
    return Math.round(this.zoomLevel * 100);
  }

  zoomIn(): void {
    this.setZoom(this.zoomLevel + this.ZOOM_STEP);
  }

  zoomOut(): void {
    this.setZoom(this.zoomLevel - this.ZOOM_STEP);
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  // ── Edge helpers ───────────────────────────────────────────────────────────
  getEdgeX1(sourceId: string, targetId: string): number {
    return this.edgeAnchor(sourceId, targetId).x;
  }

  getEdgeY1(sourceId: string, targetId: string): number {
    return this.edgeAnchor(sourceId, targetId).y;
  }

  getEdgeX2(sourceId: string, targetId: string): number {
    return this.edgeAnchor(targetId, sourceId).x;
  }

  getEdgeY2(sourceId: string, targetId: string): number {
    return this.edgeAnchor(targetId, sourceId).y;
  }

  private edgeAnchor(fromId: string, toId: string): { x: number; y: number } {
    return edgeAnchorBetween(this.store.nodes(), fromId, toId);
  }

  get selectedEdge(): DiagramEdge | null {
    return this.edgeEditor.getSelectedEdge(this.store.edges(), this.selectedEdgeId);
  }

  onEdgeClick(event: MouseEvent, edge: DiagramEdge): void {
    if (this.activeTool !== 'pointer') return;
    event.stopPropagation();
    this.selectedAnnotationId = null;
    this.store.selectNode(null);
    this.selectedEdgeId = edge.id;
  }

  updateSelectedEdgeStyle(changes: Partial<EdgeStyle>): void {
    this.store.setEdges(this.edgeEditor.updateEdgeStyle(this.store.edges(), this.selectedEdgeId, changes));
  }

  setSelectedEdgeDashStyle(style: string): void {
    this.store.setEdges(this.edgeEditor.setDashStyle(this.store.edges(), this.selectedEdgeId, style));
  }

  setSelectedEdgeMarker(value: string): void {
    this.store.setEdges(this.edgeEditor.setMarker(this.store.edges(), this.selectedEdgeId, value));
  }

  setSelectedEdgeAnimated(animated: boolean): void {
    this.store.setEdges(this.edgeEditor.setAnimated(this.store.edges(), this.selectedEdgeId, animated));
  }

  resetSelectedEdgeStyle(): void {
    this.store.setEdges(this.edgeEditor.resetStyle(this.store.edges(), this.selectedEdgeId));
  }

  dashStyleValue(style: EdgeStyle): string {
    return this.edgeEditor.dashStyleValue(style);
  }

  colorValue(event: Event): string {
    return (event.target as HTMLInputElement).value || '#605e5c';
  }

  numberValue(event: Event): number {
    return Number((event.target as HTMLInputElement | HTMLSelectElement).value || 1);
  }

  selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  checkedValue(event: Event): boolean {
    return !!(event.target as HTMLInputElement).checked;
  }

  textValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value ?? '';
  }

  setResourceEditorStatus(event: Event): void {
    if (!this.resourceEditorDraft) return;
    const value = this.selectValue(event);
    if (value === 'running' || value === 'stopped' || value === 'failed' || value === 'unknown') {
      this.resourceEditorDraft.status = value;
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  onContextMenuRequested(req: ContextMenuRequest): void {
    const node = this.store.nodes().find(n => n.id === req.nodeId);
    if (!node) return;
    this.contextMenu = { ...req, node };
  }

  closeContextMenu(): void {
    this.contextMenu = null;
  }

  ctxDelete(): void {
    if (!this.contextMenu) return;
    this.store.deleteNode(this.contextMenu.nodeId);
    this.closeContextMenu();
  }

  ctxTogglePin(): void {
    if (!this.contextMenu) return;
    this.togglePin(this.contextMenu.nodeId);
    this.closeContextMenu();
  }

  ctxCopyName(): void {
    if (!this.contextMenu) return;
    navigator.clipboard.writeText(this.contextMenu.node.label);
    this.closeContextMenu();
  }

  ctxCopyResourceId(): void {
    if (!this.contextMenu) return;
    navigator.clipboard.writeText(this.contextMenu.node.metadata?.id ?? '');
    this.closeContextMenu();
  }

  ctxFocus(): void {
    if (!this.contextMenu) return;
    this.store.selectNode(this.contextMenu.nodeId);
    this.closeContextMenu();
  }

  // ── Resource editor ───────────────────────────────────────────────────────
  openResourceEditor(nodeId: string): void {
    const node = this.store.nodes().find(n => n.id === nodeId);
    if (!node) return;
    this.resourceEditorNodeId = nodeId;
    this.resourceEditorDraft = this.resourceEditor.toDraft(node);
    this.resourceEditorOpen = true;
  }

  closeResourceEditor(): void {
    this.resourceEditorOpen = false;
    this.resourceEditorNodeId = null;
    this.resourceEditorDraft = null;
  }

  saveResourceEditor(): void {
    if (!this.resourceEditorOpen || !this.resourceEditorNodeId || !this.resourceEditorDraft) return;
    this.store.setNodes(this.resourceEditor.applyDraft(this.store.nodes(), this.resourceEditorNodeId, this.resourceEditorDraft));
    this.closeResourceEditor();
  }

  addInternalItem(): void {
    if (!this.resourceEditorDraft) return;
    this.resourceEditorDraft = this.resourceEditor.addInternalItem(this.resourceEditorDraft);
  }

  removeInternalItem(itemId: string): void {
    if (!this.resourceEditorDraft) return;
    this.resourceEditorDraft = this.resourceEditor.removeInternalItem(this.resourceEditorDraft, itemId);
  }

  updateInternalItemText(itemId: string, text: string): void {
    if (!this.resourceEditorDraft) return;
    this.resourceEditorDraft = this.resourceEditor.updateInternalItemText(this.resourceEditorDraft, itemId, text);
  }

  onInternalItemMoved(req: InternalItemMoveRequest): void {
    this.store.setNodes(this.resourceEditor.applyInternalItemMove(this.store.nodes(), req));
  }

  // ── Container rename ──────────────────────────────────────────────────────
  startRename(type: 'rg' | 'sub' | 'vm' | 'rt', id: string, currentName: string): void {
    this.renamingContainer = { type, id };
    this.renamingValue = currentName;
    setTimeout(() => {
      const el = this.renameInputRef?.nativeElement as HTMLInputElement | undefined;
      if (el) { el.focus(); el.select(); }
    }, 0);
  }

  commitRename(): void {
    if (!this.renamingContainer) return;
    const { type, id } = this.renamingContainer;
    const trimmed = this.renamingValue.trim();
    if (trimmed) {
      this.customContainerNames.set(`${type}::${id}`, trimmed);
    } else {
      this.customContainerNames.delete(`${type}::${id}`);
    }
    this.renamingContainer = null;
    this.renamingValue = '';
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  cancelRename(): void {
    this.renamingContainer = null;
    this.renamingValue = '';
  }

  // ── Misc ───────────────────────────────────────────────────────────────────
  togglePin(nodeId: string): void {
    const node = this.store.nodes().find(n => n.id === nodeId);
    if (!node) return;
    node.isPinned ? this.store.unpinNode(nodeId) : this.store.pinNode(nodeId);
  }

  async toggleFinOps(): Promise<void> {
    const active = !this.store.finOpsLayerActive();
    this.store.finOpsLayerActive.set(active);
    if (!active) return;

    const subIds = [...new Set(this.store.activeSubscriptions().map(s => s.subscriptionId))];
    if (subIds.length === 0) {
      this.finOpsLoadedSubscriptions = 0;
      this.finOpsError = 'No active subscriptions selected. Re-scan and select at least one subscription.';
      return;
    }

    this.finOpsLoading = true;
    this.finOpsError = null;

    try {
      const { nodes: nextNodes, loadedSubscriptions } = await this.finops.loadCostsForSubscriptions(this.store.nodes(), subIds);
      this.finOpsLoadedSubscriptions = loadedSubscriptions;
      this.store.setNodes(nextNodes);

      if (!nextNodes.some(n => n.costData)) {
        this.finOpsError = 'Cost query succeeded but no scanned resources matched cost rows for this period.';
      }
    } catch {
      this.finOpsLoadedSubscriptions = 0;
      this.finOpsError = 'Failed to load cost data. Ensure the proxy is running and you have Cost Management Reader access.';
    } finally {
      this.finOpsLoading = false;
    }
  }

  get finOpsCostedNodeCount(): number {
    return this.store.nodes().filter(n => (n.costData?.monthlyCostUsd ?? 0) > 0).length;
  }

  get finOpsTopNodes(): Array<{ id: string; label: string; cost: number }> {
    return this.store.nodes()
      .filter(n => (n.costData?.monthlyCostUsd ?? 0) > 0)
      .sort((a, b) => (b.costData?.monthlyCostUsd ?? 0) - (a.costData?.monthlyCostUsd ?? 0))
      .slice(0, 5)
      .map(n => ({ id: n.id, label: n.label, cost: n.costData!.monthlyCostUsd }));
  }

  formatUsd(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  toggleDrift(): void {
    if (!this.store.comparisonMode()) {
      this.store.setNodes(this.driftSvc.computeDrift(this.store.baselineNodes(), this.store.nodes()));
      this.store.comparisonMode.set(true);
    } else {
      this.store.comparisonMode.set(false);
      this.store.setNodes(this.store.nodes().map(n => ({ ...n, driftStatus: undefined })));
    }
  }

  exportSvg(): void { if (this.canvasHostRef) this.exportSvc.exportSVG(this.canvasHostRef); }
  async exportPng(): Promise<void> { if (this.canvasHostRef) await this.exportSvc.exportPNG(this.canvasHostRef); }
  exportJson(): void { this.exportSvc.exportJSON(this.store.nodes(), this.store.edges(), this.store.activeSubscriptions()); }

  async onImportJson(file: File): Promise<void> {
    try {
      const state = await this.exportSvc.importJSON(file);
      this.store.loadBaseline(state.nodes);
    } catch { console.error('Failed to import ZureMap JSON'); }
  }

  rescan(): void { this.store.clearDiagram(); this.router.navigate(['/scan']); }

  // ── Private helpers ────────────────────────────────────────────────────────
  private svgPoint(e: MouseEvent): { x: number; y: number } {
    const host = this.canvasHostRef?.nativeElement as HTMLElement;
    if (!host) return { x: e.clientX, y: e.clientY };
    const rect = host.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left + host.scrollLeft) / this.zoomLevel,
      y: (e.clientY - rect.top + host.scrollTop) / this.zoomLevel,
    };
  }

  private setZoom(nextZoom: number, anchor?: { x: number; y: number }): void {
    const host = this.canvasHostRef?.nativeElement as HTMLElement;
    const prevZoom = this.zoomLevel;
    const zoom = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, Number(nextZoom.toFixed(2))));
    if (zoom === prevZoom) return;

    if (!host || !anchor) {
      this.store.zoomLevel.set(zoom);
      return;
    }

    const rect = host.getBoundingClientRect();
    const localX = anchor.x - rect.left;
    const localY = anchor.y - rect.top;
    const worldX = (host.scrollLeft + localX) / prevZoom;
    const worldY = (host.scrollTop + localY) / prevZoom;

    this.store.zoomLevel.set(zoom);

    host.scrollLeft = Math.max(0, worldX * zoom - localX);
    host.scrollTop = Math.max(0, worldY * zoom - localY);
  }

  private newAnnotation(type: Annotation['type'], x: number, y: number): Annotation {
    return {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type, color: this.activeColor, strokeWidth: this.activeStrokeWidth,
      strokeStyle: this.activeStrokeStyle,
      sloppiness: this.activeSloppiness,
      edgeRouting: this.activeEdgeRouting,
      edgeMode: type === 'arrow' ? (this.activeEdgeMode === 'none' ? 'end' : this.activeEdgeMode) : this.activeEdgeMode,
      fillOpacity: this.activeFillOpacity,
      fill: this.activeFill, x, y, fontSize: 14,
    };
  }

  private buildSmoothPath(pts: Array<[number, number]>): string {
    if (pts.length < 2) return pts.length === 1 ? `M ${pts[0][0]} ${pts[0][1]}` : '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
    }
    d += ` L ${pts.at(-1)![0]} ${pts.at(-1)![1]}`;
    return d;
  }

  private normalizeRect(x1: number, y1: number, x2: number, y2: number) {
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }

  private clearPreviews(): void {
    this.previewPath = '';
    this.previewArrow = null;
    this.previewLine = null;
    this.previewRect = null;
    this.previewDiamond = null;
    this.previewEllipse = null;
  }
}
