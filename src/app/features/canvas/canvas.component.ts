import { Component, inject, effect, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import {
  DiagramNodeComponent,
  ContextMenuRequest,
  InternalItemMoveRequest,
  NodeResizeRequest,
  RouteTableExpansionRequest,
  VirtualNetworkExpansionRequest,
  NsgExpansionRequest,
  StorageAccountExpansionRequest,
  AksExpansionRequest,
  VmExpansionRequest,
  UaiExpansionRequest,
  HostingEnvironmentExpansionRequest,
  ServerFarmExpansionRequest,
  PublicIpExpansionRequest,
} from './diagram-node/diagram-node.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { DrawingToolbarComponent } from './drawing-toolbar/drawing-toolbar.component';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { Annotation, DrawingTool, StrokeStyle, EdgeRouting, EdgeMode } from '../../core/models/annotation.model';
import { DiagramEdge, EdgeStyle } from '../../core/models/diagram-edge.model';
import {
  RgBound,
  SubscriptionBound,
  VmBound,
  RouteTableBound,
  ResourceEditorDraft,
  ToolbarDragState,
  SubscriptionDragState,
  VmDragState,
  NodeDragState,
  RgDragState,
  EdgeWaypointDragState,
  AnnWaypointDragState,
  TagRule,
} from './canvas.types';
import { CanvasEdgeEditorService } from './canvas-edge-editor.service';
import { CanvasResourceEditorService } from './canvas-resource-editor.service';
import { CanvasVisibilityService } from './canvas-visibility.service';
import { CanvasCollapseService } from './canvas-collapse.service';
import { CanvasAnnotationService } from './canvas-annotation.service';
import { CanvasDragService } from './canvas-drag.service';
import { CanvasOverlapService } from './canvas-overlap.service';
import { CanvasActionsService } from './canvas-actions.service';
import {
  diamondPointsFromRect as diamondPointsFromRectUtil,
  edgeAnchorBetween,
  edgePolylinePoints,
  linePointsFromAnnotation,
  linePointsFromCoords as linePointsFromCoordsUtil,
  polylinePointsString,
  sloppyFilterForLevel,
  strokeDashArrayForStyle,
} from './canvas-geometry.util';
import { DrawingRuntimeState, DrawingStyleState, onDrawEnd, onDrawMove, onDrawStart, resetDrawingRuntime } from './canvas-drawing.util';

type SizeOffset = { top: number; right: number; bottom: number; left: number };
interface TagHighlightInfo {
  ruleId: string;
  borderColor: string;
  bgColor: string;
  badgeLabel?: string;
  sizeOffset?: SizeOffset;
}
const ZERO_OFFSET: SizeOffset = { top: 0, right: 0, bottom: 0, left: 0 };

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, DiagramNodeComponent, SidebarComponent, ToolbarComponent, DrawingToolbarComponent],
  templateUrl: "./canvas.component.html",
  styleUrl: "./canvas.component.scss",
})
export class CanvasComponent {
  @ViewChild('canvasHost', { read: ElementRef }) canvasHostRef!: ElementRef;
  @ViewChild('exportRoot', { read: ElementRef }) exportRootRef!: ElementRef;
  @ViewChild('editTextarea') editTextareaRef?: ElementRef;
  @ViewChild('renameInput') renameInputRef?: ElementRef;

  store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  private actions = inject(CanvasActionsService);
  private edgeEditor = inject(CanvasEdgeEditorService);
  private resourceEditor = inject(CanvasResourceEditorService);
  private visibilitySvc = inject(CanvasVisibilityService);
  private collapseSvc = inject(CanvasCollapseService);
  private annotationSvc = inject(CanvasAnnotationService);
  private dragSvc = inject(CanvasDragService);
  private overlapSvc = inject(CanvasOverlapService);
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

  /** Map of rgBound.id → highlight info for matched tag rules. */
  rgTagHighlights = new Map<string, TagHighlightInfo>();
  /** Map of subscriptionId → highlight info for matched tag rules. */
  subTagHighlights = new Map<string, TagHighlightInfo>();
  /** Map of node.id → highlight color for node-level tag rules. */
  nodeTagHighlights = new Map<string, string>();

  /** ID of the tag-rule highlight currently selected on canvas (for resize/delete). */
  selectedTagHighlightRuleId: string | null = null;
  /** Active resize drag for a tag rule highlight. */
  tagHighlightResizeDrag: {
    ruleId: string;
    handle: string;
    startX: number;
    startY: number;
    startOffset: SizeOffset;
    currentOffset: SizeOffset;
  } | null = null;

  readonly resizeHandles = [
    { id: 'nw', left: '0%',   top: '0%',   cursor: 'nw-resize' },
    { id: 'n',  left: '50%',  top: '0%',   cursor: 'n-resize'  },
    { id: 'ne', left: '100%', top: '0%',   cursor: 'ne-resize' },
    { id: 'e',  left: '100%', top: '50%',  cursor: 'e-resize'  },
    { id: 'se', left: '100%', top: '100%', cursor: 'se-resize' },
    { id: 's',  left: '50%',  top: '100%', cursor: 's-resize'  },
    { id: 'sw', left: '0%',   top: '100%', cursor: 'sw-resize' },
    { id: 'w',  left: '0%',   top: '50%',  cursor: 'w-resize'  },
  ];
  /** All tag keys + their known values across all nodes, for autofill. */
  availableTags = new Map<string, Set<string>>();
  private collapsedResourceGroups = new Set<string>();
  private collapsedSubscriptions = new Set<string>();
  private collapsedVmGroups = new Set<string>();
  private collapsedRouteTableGroups = new Set<string>();
  private isResolvingRgOverlaps = false;

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
  rgDragState: RgDragState | null = null;
  get isRgDragging(): boolean { return this.rgDragState !== null; }
  subscriptionDragState: SubscriptionDragState | null = null;
  get isSubscriptionDragging(): boolean { return this.subscriptionDragState !== null; }
  vmDragState: VmDragState | null = null;
  get isVmDragging(): boolean { return this.vmDragState !== null; }

  // Individual node mouse drag
  nodeDragState: NodeDragState | null = null;

  // Context menu
  contextMenu: (ContextMenuRequest & { node: DiagramNode }) | null = null;
  annotationContextMenu: { x: number; y: number; annotationId: string } | null = null;

  // Container rename
  renamingContainer: { type: 'rg' | 'sub' | 'vm' | 'rt'; id: string } | null = null;
  renamingValue = '';

  // Floating toolbar drag
  toolbarPos = { x: 12, y: 12 };
  toolbarDragState: ToolbarDragState | null = null;

  // Node HTML5 drag
  private dragOffset = { x: 0, y: 0 };
  private routeTableCollapsedHeights = new Map<string, number>();
  private virtualNetworkCollapsedHeights = new Map<string, number>();
  private nsgCollapsedHeights = new Map<string, number>();
  private storageAccountCollapsedHeights = new Map<string, number>();
  private aksCollapsedHeights = new Map<string, number>();
  private vmDetailCollapsedHeights = new Map<string, number>();
  private uaiCollapsedHeights = new Map<string, number>();
  private hostingEnvironmentCollapsedHeights = new Map<string, number>();
  private serverFarmCollapsedHeights = new Map<string, number>();
  private publicIpCollapsedHeights = new Map<string, number>();
  selectedEdgeId: string | null = null;
  edgeWaypointDragState: EdgeWaypointDragState | null = null;
  annWaypointDragState: AnnWaypointDragState | null = null;
  relayoutBusy = false;
  resourceEditorOpen = false;
  resourceEditorNodeId: string | null = null;
  resourceEditorDraft: ResourceEditorDraft | null = null;

  exportDialogOpen = false;
  exportBg: 'white' | 'black' | 'transparent' = 'white';
  exportEmbed = false;
  exportBusy = false;

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      this.store.redo();
      return;
    }
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
      e.preventDefault();
      this.deleteSelectedAnnotation();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.store.selectedNodeId()) {
      e.preventDefault();
      this.deleteSelectedNode();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedTagHighlightRuleId) {
      e.preventDefault();
      const ruleId = this.selectedTagHighlightRuleId;
      this.selectedTagHighlightRuleId = null;
      this.store.tagRules.set(this.store.tagRules().filter(r => r.id !== ruleId));
      this.recomputeTagHighlights(this.store.nodes());
      return;
    }
    if (e.key === 'Escape') {
      this.closeContextMenu();
      this.cancelRename();
      this.selectedAnnotationId = null;
      this.selectedTagHighlightRuleId = null;
      if (this.editingAnnotation) this.cancelEdit();
    }
  }

  // ── Document-level mouse events (for drag completion outside SVG) ──────────
  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(e: MouseEvent): void {
    if (this.activeTool !== 'pointer' && this.isDrawing) {
      this.onDrawMouseMove(e);
      return;
    }

    if (this.tagHighlightResizeDrag) {
      const drag = this.tagHighlightResizeDrag;
      const dxL = (e.clientX - drag.startX) / this.zoomLevel;
      const dyL = (e.clientY - drag.startY) / this.zoomLevel;
      const b = drag.startOffset;
      const off = { ...b };
      switch (drag.handle) {
        case 'nw': off.left = Math.max(0, b.left - dxL); off.top = Math.max(0, b.top - dyL); break;
        case 'n':  off.top  = Math.max(0, b.top  - dyL); break;
        case 'ne': off.right = Math.max(0, b.right + dxL); off.top = Math.max(0, b.top - dyL); break;
        case 'e':  off.right  = Math.max(0, b.right  + dxL); break;
        case 'se': off.right  = Math.max(0, b.right  + dxL); off.bottom = Math.max(0, b.bottom + dyL); break;
        case 's':  off.bottom = Math.max(0, b.bottom + dyL); break;
        case 'sw': off.left   = Math.max(0, b.left   - dxL); off.bottom = Math.max(0, b.bottom + dyL); break;
        case 'w':  off.left   = Math.max(0, b.left   - dxL); break;
      }
      this.tagHighlightResizeDrag = { ...drag, currentOffset: off };
      return;
    }

    if (this.edgeWaypointDragState) {
      const pt = this.svgPoint(e);
      const { edgeId, waypointIndex, lastX, lastY } = this.edgeWaypointDragState;
      const dx = pt.x - lastX;
      const dy = pt.y - lastY;
      this.edgeWaypointDragState = { edgeId, waypointIndex, lastX: pt.x, lastY: pt.y };
      this.store.setEdges(this.store.edges().map(edge => {
        if (edge.id !== edgeId) return edge;
        const wps = [...(edge.waypoints ?? [])];
        wps[waypointIndex] = { x: wps[waypointIndex].x + dx, y: wps[waypointIndex].y + dy };
        return { ...edge, waypoints: wps };
      }));
      return;
    }

    if (this.annWaypointDragState) {
      const pt = this.svgPoint(e);
      const { annId, waypointIndex, lastX, lastY } = this.annWaypointDragState;
      const dx = pt.x - lastX;
      const dy = pt.y - lastY;
      this.annWaypointDragState = { annId, waypointIndex, lastX: pt.x, lastY: pt.y };
      const ann = this.store.annotations().find(a => a.id === annId);
      if (ann) {
        const wps = [...(ann.waypoints ?? [])];
        wps[waypointIndex] = { x: wps[waypointIndex].x + dx, y: wps[waypointIndex].y + dy };
        this.store.updateAnnotation(annId, { waypoints: wps });
      }
      return;
    }

    const result = this.dragSvc.onDocumentMouseMove({
      event: e,
      zoomLevel: this.zoomLevel,
      toolbarPos: this.toolbarPos,
      toolbarDragState: this.toolbarDragState,
      nodeDragState: this.nodeDragState,
      subscriptionDragState: this.subscriptionDragState,
      vmDragState: this.vmDragState,
      rgDragState: this.rgDragState,
      annDragId: this.annDragId,
      annDragMouse: this.annDragMouse,
      annDragOrigin: this.annDragOrigin,
      nodes: this.store.nodes(),
      svgPoint: event => this.svgPoint(event),
      moveNode: (id, position) => this.store.moveNode(id, position),
      moveSubscriptionGroup: (subscriptionId, delta) => this.store.moveSubscriptionGroup(subscriptionId, delta),
      moveVmGroup: (vmId, delta) => this.store.moveVmGroup(vmId, delta),
      moveResourceGroup: (id, delta) => this.store.moveNodeGroup(id, delta),
      updateAnnotation: (id, changes) => this.store.updateAnnotation(id, changes),
    });
    if (!result.handled) return;
    this.toolbarPos = result.toolbarPos;
    this.toolbarDragState = result.toolbarDragState;
    this.nodeDragState = result.nodeDragState;
    this.subscriptionDragState = result.subscriptionDragState;
    this.vmDragState = result.vmDragState;
    this.rgDragState = result.rgDragState;
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? this.ZOOM_STEP : -this.ZOOM_STEP;
    this.setZoom(this.zoomLevel + delta, { x: event.clientX, y: event.clientY });
  }

  @HostListener('document:mouseup', ['$event'])
  onDocMouseUp(e: MouseEvent): void {
    if (this.activeTool !== 'pointer' && this.isDrawing) {
      this.onDrawMouseUp(e);
    }
    if (this.tagHighlightResizeDrag) {
      const { ruleId, currentOffset } = this.tagHighlightResizeDrag;
      this.store.tagRules.set(
        this.store.tagRules().map(r => r.id === ruleId ? { ...r, sizeOffset: currentOffset } : r)
      );
      this.recomputeTagHighlights(this.store.nodes());
      this.tagHighlightResizeDrag = null;
    }
    this.toolbarDragState = null;
    this.subscriptionDragState = null;
    this.vmDragState = null;
    this.rgDragState = null;
    this.nodeDragState = null;
    this.annDragId = null;
    this.edgeWaypointDragState = null;
    this.annWaypointDragState = null;
  }

  // ── Tool management ────────────────────────────────────────────────────────
  setTool(tool: DrawingTool): void {
    this.activeTool = tool;
    this.selectedAnnotationId = null;
    this.selectedEdgeId = null;
    this.applyDrawingRuntime(resetDrawingRuntime(this.currentDrawingRuntime()));
  }

  onToolbarColorChange(color: string): void {
    this.activeColor = color;
    this.updateSelectedAnnotation({ color });
  }

  onToolbarStrokeWidthChange(strokeWidth: number): void {
    this.activeStrokeWidth = strokeWidth;
    this.updateSelectedAnnotation({ strokeWidth });
  }

  onToolbarStrokeStyleChange(strokeStyle: StrokeStyle): void {
    this.activeStrokeStyle = strokeStyle;
    this.updateSelectedAnnotation({ strokeStyle });
  }

  onToolbarSloppinessChange(sloppiness: number): void {
    this.activeSloppiness = sloppiness;
    this.updateSelectedAnnotation({ sloppiness });
  }

  onToolbarEdgeRoutingChange(edgeRouting: EdgeRouting): void {
    this.activeEdgeRouting = edgeRouting;
    this.updateSelectedAnnotation({ edgeRouting }, ['arrow', 'line']);
  }

  onToolbarEdgeModeChange(edgeMode: EdgeMode): void {
    this.activeEdgeMode = edgeMode;
    this.updateSelectedAnnotation({ edgeMode }, ['arrow', 'line']);
  }

  onToolbarFillChange(fill: string): void {
    this.activeFill = fill;
    this.updateSelectedAnnotation({ fill }, ['rect', 'ellipse', 'diamond']);
  }

  onToolbarFillOpacityChange(fillOpacity: number): void {
    this.activeFillOpacity = fillOpacity;
    this.updateSelectedAnnotation({ fillOpacity }, ['rect', 'ellipse', 'diamond']);
  }

  // ── Drawing surface events ─────────────────────────────────────────────────
  onDrawMouseDown(e: MouseEvent): void {
    e.preventDefault();
    const pt = this.svgPoint(e);
    const result = onDrawStart(this.currentDrawingRuntime(), this.currentDrawingStyle(), pt);
    this.applyDrawingRuntime(result.next);
    if (result.createdAnnotation) {
      this.store.pushUndo();
      this.store.addAnnotation(result.createdAnnotation);
      if (result.shouldStartEdit) this.startEditAnnotation(result.createdAnnotation);
    }
  }

  onDrawMouseMove(e: MouseEvent): void {
    const pt = this.svgPoint(e);
    this.applyDrawingRuntime(onDrawMove(this.currentDrawingRuntime(), this.currentDrawingStyle(), pt));
  }

  onDrawMouseUp(e: MouseEvent): void {
    const pt = this.svgPoint(e);
    const result = onDrawEnd(this.currentDrawingRuntime(), this.currentDrawingStyle(), pt);
    this.applyDrawingRuntime(result.next);
    if (result.createdAnnotation) {
      this.store.pushUndo();
      this.store.addAnnotation(result.createdAnnotation);
    }
  }

  // ── Annotation interaction ─────────────────────────────────────────────────
  onAnnotationMouseDown(e: MouseEvent, ann: Annotation): void {
    if (this.activeTool !== 'pointer') return;
    e.stopPropagation();
    this.annotationContextMenu = null;
    this.contextMenu = null;
    this.selectedEdgeId = null;
    this.selectedAnnotationId = ann.id;
    this.syncToolbarFromAnnotation(ann);
    const pt = this.svgPoint(e);
    this.store.pushUndo();
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
    this.store.pushUndo();
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
      this.store.pushUndo();
      this.store.deleteAnnotation(this.selectedAnnotationId);
      this.selectedAnnotationId = null;
    }
  }

  duplicateSelectedAnnotation(): void {
    if (!this.selectedAnnotationId) return;
    const source = this.annotationById(this.selectedAnnotationId);
    if (!source) return;
    const duplicated = this.annotationSvc.duplicate(source);
    this.store.pushUndo();
    this.store.addAnnotation(duplicated);
    this.selectedAnnotationId = duplicated.id;
    this.syncToolbarFromAnnotation(duplicated);
  }

  bringSelectedAnnotationToFront(): void {
    if (!this.selectedAnnotationId) return;
    const selectedId = this.selectedAnnotationId;
    this.store.pushUndo();
    this.store.annotations.update(list => this.annotationSvc.bringToFront(list, selectedId));
  }

  sendSelectedAnnotationToBack(): void {
    if (!this.selectedAnnotationId) return;
    const selectedId = this.selectedAnnotationId;
    this.store.pushUndo();
    this.store.annotations.update(list => this.annotationSvc.sendToBack(list, selectedId));
  }

  clearAllAnnotations(): void {
    if (this.store.annotations().length === 0) return;
    const shouldClear = confirm('Clear all annotations from this diagram?');
    if (!shouldClear) return;
    this.store.pushUndo();
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
    return this.annotationSvc.deleteButtonX(ann);
  }

  annDeleteBtnY(ann: Annotation): number {
    return this.annotationSvc.deleteButtonY(ann);
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
    return this.annotationSvc.markerStart(ann);
  }

  markerEnd(ann: Annotation): string | null {
    return this.annotationSvc.markerEnd(ann);
  }

  previewMarkerStart(): string | null {
    return this.annotationSvc.previewMarkerStart(this.activeEdgeMode);
  }

  previewMarkerEnd(): string | null {
    return this.annotationSvc.previewMarkerEnd(this.activeEdgeMode);
  }

  arrowHead(x1: number, y1: number, x2: number, y2: number): string {
    return this.annotationSvc.arrowHead(x1, y1, x2, y2);
  }

  // ── Canvas size ────────────────────────────────────────────────────────────
  get canvasWidth(): number {
    const nodes = this.store.nodes();
    const anns = this.store.annotations();
    let maxX = 1200;

    for (const n of nodes) {
      maxX = Math.max(maxX, n.position.x + n.size.width + 80);
    }
    for (const ann of anns) {
      maxX = Math.max(maxX, this.annotationMaxX(ann) + 80);
    }
    maxX = Math.max(maxX, this.previewMaxX() + 80);

    return maxX;
  }

  get canvasHeight(): number {
    const nodes = this.store.nodes();
    const anns = this.store.annotations();
    let maxY = 800;

    for (const n of nodes) {
      maxY = Math.max(maxY, n.position.y + n.size.height + 80);
    }
    for (const ann of anns) {
      maxY = Math.max(maxY, this.annotationMaxY(ann) + 80);
    }
    maxY = Math.max(maxY, this.previewMaxY() + 80);

    return maxY;
  }

  toggleSubscriptionCollapsed(subscriptionId: string): void {
    const result = this.collapseSvc.toggleSubscription(
      this.collapsedSubscriptions,
      subscriptionId,
      this.store.selectedNode(),
    );
    this.collapsedSubscriptions = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleRgCollapsed(rgId: string): void {
    const result = this.collapseSvc.toggleResourceGroup(
      this.collapsedResourceGroups,
      rgId,
      this.store.selectedNode(),
    );
    this.collapsedResourceGroups = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleVmCollapsed(vmId: string): void {
    const result = this.collapseSvc.toggleVm(
      this.collapsedVmGroups,
      vmId,
      this.store.nodes(),
      this.store.selectedNode(),
    );
    this.collapsedVmGroups = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleRouteTableCollapsed(routeTableId: string): void {
    const result = this.collapseSvc.toggleRouteTable(
      this.collapsedRouteTableGroups,
      routeTableId,
      this.store.nodes(),
      this.store.selectedNode(),
    );
    this.collapsedRouteTableGroups = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  private refreshVisibility(nodes: DiagramNode[], edges: ReturnType<DiagramStore['edges']>): void {
    const visibility = this.visibilitySvc.derive({
      nodes,
      edges,
      activeSubscriptions: this.store.activeSubscriptions(),
      collapsedSubscriptions: this.collapsedSubscriptions,
      collapsedResourceGroups: this.collapsedResourceGroups,
      collapsedVmGroups: this.collapsedVmGroups,
      collapsedRouteTableGroups: this.collapsedRouteTableGroups,
      customContainerNames: this.store.customContainerNames(),
      selectedEdgeId: this.selectedEdgeId,
    });
    this.visibleNodes = visibility.visibleNodes;
    this.visibleEdges = visibility.visibleEdges;
    this.rgBounds = visibility.rgBounds;
    this.subscriptionBounds = visibility.subscriptionBounds;
    this.vmBounds = visibility.vmBounds;
    this.routeTableBounds = visibility.routeTableBounds;
    if (this.selectedEdgeId && !visibility.selectedEdgeVisible) {
      this.selectedEdgeId = null;
    }
    this.resolveSubscriptionContainerOverlaps(this.subscriptionBounds);
    this.resolveRgContainerOverlaps(this.rgBounds);
    this.recomputeTagHighlights(nodes);
  }

  private resolveSubscriptionContainerOverlaps(bounds: SubscriptionBound[]): void {
    this.overlapSvc.resolveSubscriptionContainerOverlaps({
      bounds,
      nodes: this.store.nodes(),
      activeSubscriptions: this.store.activeSubscriptions(),
      collapsedSubscriptions: this.collapsedSubscriptions,
      collapsedResourceGroups: this.collapsedResourceGroups,
      customContainerNames: this.store.customContainerNames(),
      draggedSubscriptionId: this.subscriptionDragState?.subscriptionId,
      moveSubscriptionGroup: (subscriptionId, delta) => this.store.moveSubscriptionGroup(subscriptionId, delta),
    });
  }

  private resolveRgContainerOverlaps(bounds: RgBound[]): void {
    if (this.isResolvingRgOverlaps || bounds.length < 2) return;
    const gap = 18;
    const maxIters = 16;
    const draggedRgId = this.rgDragState?.id;
    this.isResolvingRgOverlaps = true;
    try {
      for (let iter = 0; iter < maxIters; iter++) {
        let moved = false;
        const nodes = this.store.nodes();
        const current = this.visibilitySvc.computeRgBounds(
          nodes.filter(n => !this.collapsedSubscriptions.has(n.metadata?.subscriptionId || '')),
          this.collapsedResourceGroups,
          this.store.customContainerNames(),
        );

        outer:
        for (let i = 0; i < current.length; i++) {
          for (let j = i + 1; j < current.length; j++) {
            const a = current[i];
            const b = current[j];
            if (!a.subscriptionId || !b.subscriptionId || a.subscriptionId !== b.subscriptionId) continue;

            // Overlap is positive when penetrating, negative when apart.
            // Start pushing once containers are within `gap` of each other in both axes.
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (overlapX <= -gap || overlapY <= -gap) continue;

            const moveX = overlapX + gap;
            const moveY = overlapY + gap;

            // Never push the container being dragged — always push the other one.
            // Among non-dragged containers, resolve along the axis needing less movement,
            // pushing the container that sits further in that direction.
            const aIsDragged = a.id === draggedRgId;
            const bIsDragged = b.id === draggedRgId;

            if (moveX <= moveY) {
              const pushTarget = aIsDragged || (!bIsDragged && a.x <= b.x) ? b : a;
              const sign = pushTarget === b ? 1 : -1;
              this.store.moveNodeGroup(pushTarget.id, { dx: moveX * sign, dy: 0 });
            } else {
              const pushTarget = aIsDragged || (!bIsDragged && a.y <= b.y) ? b : a;
              const sign = pushTarget === b ? 1 : -1;
              this.store.moveNodeGroup(pushTarget.id, { dx: 0, dy: moveY * sign });
            }

            moved = true;
            break outer;
          }
        }
        if (!moved) break;
      }
    } finally {
      this.isResolvingRgOverlaps = false;
    }
  }

  onTagRulesChange(rules: TagRule[]): void {
    this.store.tagRules.set(rules);
    this.recomputeTagHighlights(this.store.nodes());
  }

  private recomputeTagHighlights(nodes: DiagramNode[]): void {
    const rules = this.store.tagRules();
    this.rgTagHighlights = new Map();
    this.subTagHighlights = new Map();
    this.nodeTagHighlights = new Map();

    // Rebuild availableTags from all nodes
    const tagMap = new Map<string, Set<string>>();
    for (const node of nodes) {
      const tags = node.metadata?.tags ?? {};
      for (const [k, v] of Object.entries(tags)) {
        if (!tagMap.has(k)) tagMap.set(k, new Set());
        if (v != null && String(v) !== '') tagMap.get(k)!.add(String(v));
      }
    }
    this.availableTags = tagMap;

    if (!rules.length) return;

    // Build per-RG, per-subscription, and per-node tag maps
    const rgTagMap = new Map<string, Map<string, Set<string>>>();
    const subTagMap = new Map<string, Map<string, Set<string>>>();
    const nodeTagMap = new Map<string, Map<string, Set<string>>>();
    for (const node of nodes) {
      const rg = node.metadata?.resourceGroup || '';
      const sub = node.metadata?.subscriptionId || '';
      if (!rg || !sub) continue;
      const rgKey = `${sub}::${rg}`;
      if (!rgTagMap.has(rgKey)) rgTagMap.set(rgKey, new Map());
      if (!subTagMap.has(sub)) subTagMap.set(sub, new Map());

      // Per-node: tags on the node itself
      const nodeTags = new Map<string, Set<string>>();
      const tags = node.metadata?.tags ?? {};
      for (const [k, v] of Object.entries(tags)) {
        const val = String(v ?? '');
        // aggregate for RG / sub
        const rgT = rgTagMap.get(rgKey)!;
        if (!rgT.has(k)) rgT.set(k, new Set());
        rgT.get(k)!.add(val);
        const subT = subTagMap.get(sub)!;
        if (!subT.has(k)) subT.set(k, new Set());
        subT.get(k)!.add(val);
        // per-node
        if (!nodeTags.has(k)) nodeTags.set(k, new Set());
        nodeTags.get(k)!.add(val);
      }
      nodeTagMap.set(node.id, nodeTags);
    }

    const evalRule = (rule: TagRule, tags: Map<string, Set<string>>): boolean => {
      switch (rule.operator) {
        case 'exists':    return tags.has(rule.tagKey);
        case 'notexists': return !tags.has(rule.tagKey);
        case 'eq':        return tags.get(rule.tagKey)?.has(rule.tagValue) ?? false;
        case 'neq':       return !(tags.get(rule.tagKey)?.has(rule.tagValue) ?? false);
        case 'contains':  return Array.from(tags.get(rule.tagKey) ?? []).some(v => v.includes(rule.tagValue));
      }
    };

    const toHighlight = (rule: TagRule): TagHighlightInfo => ({
      ruleId: rule.id,
      borderColor: rule.color,
      bgColor: rule.color + '22',
      badgeLabel: rule.badgeLabel,
      sizeOffset: rule.sizeOffset,
    });

    for (const rule of rules) {
      if (rule.target === 'rg' || rule.target === 'both') {
        for (const [rgKey, tags] of rgTagMap) {
          if (!this.rgTagHighlights.has(rgKey) && evalRule(rule, tags)) {
            this.rgTagHighlights.set(rgKey, toHighlight(rule));
          }
        }
      }
      if (rule.target === 'sub' || rule.target === 'both') {
        for (const [sub, tags] of subTagMap) {
          if (!this.subTagHighlights.has(sub) && evalRule(rule, tags)) {
            this.subTagHighlights.set(sub, toHighlight(rule));
          }
        }
      }
      if (rule.target === 'node') {
        for (const [nodeId, tags] of nodeTagMap) {
          if (!this.nodeTagHighlights.has(nodeId) && evalRule(rule, tags)) {
            this.nodeTagHighlights.set(nodeId, rule.color);
          }
        }
      }
    }
  }

  // ── Tag highlight selection & resize ──────────────────────────────────────

  getEffectiveSizeOffset(hl: TagHighlightInfo | undefined): SizeOffset {
    if (!hl) return ZERO_OFFSET;
    if (this.tagHighlightResizeDrag?.ruleId === hl.ruleId) {
      return this.tagHighlightResizeDrag!.currentOffset;
    }
    return hl.sizeOffset ?? ZERO_OFFSET;
  }

  getHighlightBounds(
    bound: { x: number; y: number; width: number; height: number },
    hl: TagHighlightInfo | undefined,
  ): { x: number; y: number; w: number; h: number } {
    const off = this.getEffectiveSizeOffset(hl);
    return {
      x: bound.x - off.left,
      y: bound.y - off.top,
      w: bound.width + off.left + off.right,
      h: bound.height + off.top + off.bottom,
    };
  }

  selectTagHighlight(ruleId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedTagHighlightRuleId = ruleId;
    this.selectedAnnotationId = null;
    this.store.selectedNodeId.set(null);
  }

  clearHighlightSelection(): void {
    this.selectedTagHighlightRuleId = null;
  }

  onTagHighlightResizeMouseDown(e: MouseEvent, ruleId: string, handle: string): void {
    e.preventDefault();
    e.stopPropagation();
    const rule = this.store.tagRules().find(r => r.id === ruleId);
    const startOffset = rule?.sizeOffset ?? { ...ZERO_OFFSET };
    this.tagHighlightResizeDrag = {
      ruleId, handle,
      startX: e.clientX,
      startY: e.clientY,
      startOffset,
      currentOffset: { ...startOffset },
    };
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
    this.store.pushUndo();
    this.rgDragState = { id: rgId, lastX: event.clientX, lastY: event.clientY };
  }

  onSubscriptionMouseDown(event: MouseEvent, subscriptionId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    this.subscriptionDragState = { subscriptionId, lastX: event.clientX, lastY: event.clientY };
  }

  onVmMouseDown(event: MouseEvent, vmId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    this.vmDragState = { vmId, lastX: event.clientX, lastY: event.clientY };
  }

  onNodeMouseDown(event: MouseEvent, node: DiagramNode): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedEdgeId = null;
    this.store.pushUndo();
    this.nodeDragState = { id: node.id, lastX: event.clientX, lastY: event.clientY, hasMoved: false };
  }

  onDragStart(event: DragEvent, node: DiagramNode): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.dataTransfer!.setData('nodeId', node.id);
    this.store.pushUndo();
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

  // ── Edge waypoint handles ──────────────────────────────────────────────────
  getEdgePoints(edge: DiagramEdge): { x: number; y: number }[] {
    return edgePolylinePoints(this.store.nodes(), edge);
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

  onEdgeWaypointMouseDown(e: MouseEvent, edge: DiagramEdge, waypointIndex: number): void {
    e.stopPropagation();
    e.preventDefault();
    this.store.pushUndo();
    const pt = this.svgPoint(e);
    this.edgeWaypointDragState = { edgeId: edge.id, waypointIndex, lastX: pt.x, lastY: pt.y };
  }

  onEdgeMidpointMouseDown(e: MouseEvent, edge: DiagramEdge, segmentIndex: number): void {
    e.stopPropagation();
    e.preventDefault();
    this.store.pushUndo();
    const pt = this.svgPoint(e);
    const waypoints = [...(edge.waypoints ?? [])];
    waypoints.splice(segmentIndex, 0, { x: pt.x, y: pt.y });
    this.store.setEdges(this.store.edges().map(ed => ed.id === edge.id ? { ...ed, waypoints } : ed));
    this.edgeWaypointDragState = { edgeId: edge.id, waypointIndex: segmentIndex, lastX: pt.x, lastY: pt.y };
  }

  onEdgeWaypointDblClick(e: MouseEvent, edge: DiagramEdge, waypointIndex: number): void {
    e.stopPropagation();
    this.store.pushUndo();
    const waypoints = (edge.waypoints ?? []).filter((_, i) => i !== waypointIndex);
    this.store.setEdges(this.store.edges().map(ed => ed.id === edge.id ? { ...ed, waypoints: waypoints.length ? waypoints : undefined } : ed));
  }

  // ── Annotation waypoint handles ────────────────────────────────────────────
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

  onAnnWaypointMouseDown(e: MouseEvent, ann: Annotation, waypointIndex: number): void {
    e.stopPropagation();
    e.preventDefault();
    this.store.pushUndo();
    const pt = this.svgPoint(e);
    this.annWaypointDragState = { annId: ann.id, waypointIndex, lastX: pt.x, lastY: pt.y };
  }

  onAnnMidpointMouseDown(e: MouseEvent, ann: Annotation, segmentIndex: number): void {
    e.stopPropagation();
    e.preventDefault();
    this.store.pushUndo();
    const pt = this.svgPoint(e);
    const waypoints = [...(ann.waypoints ?? [])];
    waypoints.splice(segmentIndex, 0, { x: pt.x, y: pt.y });
    this.store.updateAnnotation(ann.id, { waypoints });
    this.annWaypointDragState = { annId: ann.id, waypointIndex: segmentIndex, lastX: pt.x, lastY: pt.y };
  }

  onAnnWaypointDblClick(e: MouseEvent, ann: Annotation, waypointIndex: number): void {
    e.stopPropagation();
    this.store.pushUndo();
    const waypoints = (ann.waypoints ?? []).filter((_, i) => i !== waypointIndex);
    this.store.updateAnnotation(ann.id, { waypoints: waypoints.length ? waypoints : undefined });
  }

  updateSelectedEdgeStyle(changes: Partial<EdgeStyle>): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.updateEdgeStyle(this.store.edges(), this.selectedEdgeId, changes));
  }

  setSelectedEdgeDashStyle(style: string): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setDashStyle(this.store.edges(), this.selectedEdgeId, style));
  }

  setSelectedEdgeMarker(value: string): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setMarker(this.store.edges(), this.selectedEdgeId, value));
  }

  setSelectedEdgeAnimated(animated: boolean): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setAnimated(this.store.edges(), this.selectedEdgeId, animated));
  }

  resetSelectedEdgeStyle(): void {
    this.store.pushUndo();
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
    this.annotationContextMenu = null;
    this.contextMenu = { ...req, node };
  }

  onAnnotationContextMenu(event: MouseEvent, ann: Annotation): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu = null;
    this.selectedEdgeId = null;
    this.store.selectNode(null);
    this.selectedAnnotationId = ann.id;
    this.syncToolbarFromAnnotation(ann);
    this.annotationContextMenu = { x: event.clientX, y: event.clientY, annotationId: ann.id };
  }

  closeContextMenu(): void {
    this.contextMenu = null;
    this.annotationContextMenu = null;
  }

  ctxDelete(): void {
    if (!this.contextMenu) return;
    this.store.pushUndo();
    this.store.deleteNode(this.contextMenu.nodeId);
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

  ctxTagCount(): number {
    if (!this.contextMenu) return 0;
    const tags = this.contextMenu.node.metadata?.tags;
    if (!tags || typeof tags !== 'object') return 0;
    return Object.keys(tags).length;
  }

  ctxVisualizeTags(): void {
    if (!this.contextMenu) return;

    const nodeId = this.contextMenu.nodeId;
    const nodes = this.store.nodes();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      this.closeContextMenu();
      return;
    }

    const tags = node.metadata?.tags ?? {};
    const entries = Object.entries(tags)
      .filter(([key]) => key.trim().length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      this.closeContextMenu();
      return;
    }

    const MAX_TAGS = 40;
    const visibleEntries = entries.slice(0, MAX_TAGS);
    const hiddenCount = entries.length - visibleEntries.length;
    const compactEntries: Array<[string, string]> = hiddenCount > 0
      ? [...visibleEntries, ['_more', `+${hiddenCount} more`] as [string, string]]
      : visibleEntries;

    const TAG_ITEM_PREFIX = 'tagviz-';
    const preservedItems = (node.custom?.internalItems ?? []).filter(item => !item.id.startsWith(TAG_ITEM_PREFIX));
    const generatedItems = this.layoutTagItems(compactEntries, node.size.width, TAG_ITEM_PREFIX);
    const allItems = [...preservedItems, ...generatedItems];

    const estimatedItemHeight = 18;
    const bottomPadding = 12;
    const requiredHeight = allItems.length === 0
      ? node.size.height
      : Math.max(
          node.size.height,
          ...allItems.map(item => item.y + estimatedItemHeight + bottomPadding)
        );

    this.store.pushUndo();

    const deltaHeight = requiredHeight - node.size.height;
    const cutoffY = node.position.y + node.size.height - 2;
    const subId = node.metadata?.subscriptionId || '';
    const rg = node.metadata?.resourceGroup || node.groupId || '';

    this.store.setNodes(nodes.map(n => {
      if (n.id === node.id) {
        return {
          ...n,
          size: { ...n.size, height: requiredHeight },
          custom: { ...(n.custom ?? {}), internalItems: allItems },
        };
      }

      if (deltaHeight <= 0) return n;
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + deltaHeight) } };
    }));

    this.store.selectNode(nodeId);
    this.closeContextMenu();
  }

  ctxAnnDuplicate(): void {
    if (!this.annotationContextMenu) return;
    this.selectedAnnotationId = this.annotationContextMenu.annotationId;
    this.duplicateSelectedAnnotation();
    this.closeContextMenu();
  }

  ctxAnnBringFront(): void {
    if (!this.annotationContextMenu) return;
    this.selectedAnnotationId = this.annotationContextMenu.annotationId;
    this.bringSelectedAnnotationToFront();
    this.closeContextMenu();
  }

  ctxAnnSendBack(): void {
    if (!this.annotationContextMenu) return;
    this.selectedAnnotationId = this.annotationContextMenu.annotationId;
    this.sendSelectedAnnotationToBack();
    this.closeContextMenu();
  }

  ctxAnnCopyText(): void {
    if (!this.annotationContextMenu) return;
    const ann = this.annotationById(this.annotationContextMenu.annotationId);
    if (!ann?.text) return;
    navigator.clipboard.writeText(ann.text);
    this.closeContextMenu();
  }

  ctxAnnEditText(): void {
    if (!this.annotationContextMenu) return;
    const ann = this.annotationById(this.annotationContextMenu.annotationId);
    if (!ann || (ann.type !== 'text' && ann.type !== 'sticky')) return;
    this.startEditAnnotation(ann);
    this.closeContextMenu();
  }

  ctxAnnDelete(): void {
    if (!this.annotationContextMenu) return;
    this.store.pushUndo();
    this.store.deleteAnnotation(this.annotationContextMenu.annotationId);
    if (this.selectedAnnotationId === this.annotationContextMenu.annotationId) this.selectedAnnotationId = null;
    this.closeContextMenu();
  }

  private layoutTagItems(entries: Array<[string, string]>, nodeWidth: number, prefix: string): Array<{ id: string; text: string; x: number; y: number }> {
    const startX = 8;
    const startY = 56;
    const colGap = 6;
    const rowHeight = 18;
    const itemFootprintWidth = 96;
    const usableWidth = Math.max(40, nodeWidth - 16);
    const columns = Math.max(1, Math.floor((usableWidth + colGap) / (itemFootprintWidth + colGap)));

    return entries.map(([key, value], index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const xUnclamped = startX + col * (itemFootprintWidth + colGap);
      const x = Math.max(2, Math.min(Math.max(2, nodeWidth - 24), xUnclamped));
      const y = startY + row * rowHeight;
      const text = key === '_more' ? value : `${key}: ${value}`;
      const stableKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `tag-${index}`;
      return {
        id: `${prefix}${stableKey}`,
        text,
        x,
        y,
      };
    });
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
    this.store.pushUndo();
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
    this.store.pushUndo();
    this.store.setNodes(this.resourceEditor.applyInternalItemMove(this.store.nodes(), req));
  }

  onNodeResized(req: NodeResizeRequest): void {
    this.store.pushUndo();
    this.store.setNodes(this.store.nodes().map(n => {
      if (n.id !== req.nodeId) return n;
      const width = Math.max(100, req.width);
      const height = Math.max(70, req.height);
      const items = (n.custom?.internalItems ?? []).map(item => ({
        ...item,
        x: Math.max(2, Math.min(width - 24, item.x)),
        y: Math.max(2, Math.min(height - 20, item.y)),
      }));
      return {
        ...n,
        size: { width, height },
        custom: n.custom ? { ...n.custom, internalItems: items } : n.custom,
      };
    }));
  }

  onRouteTableExpansionChanged(req: RouteTableExpansionRequest): void {
    const nodes = this.store.nodes();
    const routeTable = nodes.find(n => n.id === req.nodeId);
    if (!routeTable) return;

    this.store.pushUndo();

    const currentHeight = routeTable.size.height;
    const collapsedHeight = this.routeTableCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.routeTableCollapsedHeights.has(req.nodeId)) {
      this.routeTableCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.routeTableCollapsedHeights.delete(req.nodeId);
    }

    // Route cards are compact but include 3 text rows + spacing + panel chrome.
    // Keep a small safety buffer to avoid clipping at different font metrics/zoom.
    const panelHeight = req.routeCount === 0 ? 48 : req.routeCount * 52 + 28;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = routeTable.metadata?.subscriptionId || '';
    const rg = routeTable.metadata?.resourceGroup || routeTable.groupId || '';
    const cutoffY = routeTable.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === routeTable.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onVirtualNetworkExpansionChanged(req: VirtualNetworkExpansionRequest): void {
    const nodes = this.store.nodes();
    const virtualNetwork = nodes.find(n => n.id === req.nodeId);
    if (!virtualNetwork) return;

    this.store.pushUndo();

    const currentHeight = virtualNetwork.size.height;
    const collapsedHeight = this.virtualNetworkCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.virtualNetworkCollapsedHeights.has(req.nodeId)) {
      this.virtualNetworkCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.virtualNetworkCollapsedHeights.delete(req.nodeId);
    }

    // Subnet cards are compact and include 2 text rows + spacing + panel chrome.
    const panelHeight = req.subnetCount === 0 ? 40 : req.subnetCount * 40 + 24;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = virtualNetwork.metadata?.subscriptionId || '';
    const rg = virtualNetwork.metadata?.resourceGroup || virtualNetwork.groupId || '';
    const cutoffY = virtualNetwork.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === virtualNetwork.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onNsgExpansionChanged(req: NsgExpansionRequest): void {
    const nodes = this.store.nodes();
    const nsg = nodes.find(n => n.id === req.nodeId);
    if (!nsg) return;

    this.store.pushUndo();

    const currentHeight = nsg.size.height;
    const collapsedHeight = this.nsgCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.nsgCollapsedHeights.has(req.nodeId)) {
      this.nsgCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.nsgCollapsedHeights.delete(req.nodeId);
    }

    // NSG rule cards have 3 rows (badges + name + ports) + spacing + panel chrome.
    const panelHeight = req.ruleCount === 0 ? 40 : req.ruleCount * 52 + 24;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = nsg.metadata?.subscriptionId || '';
    const rg = nsg.metadata?.resourceGroup || nsg.groupId || '';
    const cutoffY = nsg.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === nsg.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onStorageAccountExpansionChanged(req: StorageAccountExpansionRequest): void {
    const nodes = this.store.nodes();
    const sa = nodes.find(n => n.id === req.nodeId);
    if (!sa) return;

    this.store.pushUndo();

    const currentHeight = sa.size.height;
    const collapsedHeight = this.storageAccountCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.storageAccountCollapsedHeights.has(req.nodeId)) {
      this.storageAccountCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.storageAccountCollapsedHeights.delete(req.nodeId);
    }

    // Each item row ~24px + section header ~20px per non-empty category + panel chrome 16px.
    const panelHeight = req.itemCount === 0 ? 32 : req.itemCount * 24 + 64;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = sa.metadata?.subscriptionId || '';
    const rg = sa.metadata?.resourceGroup || sa.groupId || '';
    const cutoffY = sa.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === sa.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onVmExpansionChanged(req: VmExpansionRequest): void {
    const nodes = this.store.nodes();
    const vm = nodes.find(n => n.id === req.nodeId);
    if (!vm) return;

    this.store.pushUndo();

    const currentHeight = vm.size.height;
    const collapsedHeight = this.vmDetailCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.vmDetailCollapsedHeights.has(req.nodeId)) {
      this.vmDetailCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.vmDetailCollapsedHeights.delete(req.nodeId);
    }

    // Header badges row ~28px + up to 3 detail rows ~18px each + panel chrome 20px.
    const panelHeight = 28 + 3 * 18 + 20;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = vm.metadata?.subscriptionId || '';
    const rg = vm.metadata?.resourceGroup || vm.groupId || '';
    const cutoffY = vm.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === vm.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onAksExpansionChanged(req: AksExpansionRequest): void {
    const nodes = this.store.nodes();
    const aks = nodes.find(n => n.id === req.nodeId);
    if (!aks) return;

    this.store.pushUndo();

    const currentHeight = aks.size.height;
    const collapsedHeight = this.aksCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.aksCollapsedHeights.has(req.nodeId)) {
      this.aksCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.aksCollapsedHeights.delete(req.nodeId);
    }

    // Cluster metadata header ~28px + each node pool card ~52px + panel chrome 20px.
    const panelHeight = req.nodePoolCount === 0 ? 48 : req.nodePoolCount * 52 + 48;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = aks.metadata?.subscriptionId || '';
    const rg = aks.metadata?.resourceGroup || aks.groupId || '';
    const cutoffY = aks.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === aks.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onUaiExpansionChanged(req: UaiExpansionRequest): void {
    const nodes = this.store.nodes();
    const uai = nodes.find(n => n.id === req.nodeId);
    if (!uai) return;

    this.store.pushUndo();

    const currentHeight = uai.size.height;
    const collapsedHeight = this.uaiCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.uaiCollapsedHeights.has(req.nodeId)) {
      this.uaiCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.uaiCollapsedHeights.delete(req.nodeId);
    }

    // Assignment cards contain role + scope rows and optional description.
    const panelHeight = req.assignmentCount === 0 ? 48 : req.assignmentCount * 64 + 24;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = uai.metadata?.subscriptionId || '';
    const rg = uai.metadata?.resourceGroup || uai.groupId || '';
    const cutoffY = uai.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === uai.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onHostingEnvironmentExpansionChanged(req: HostingEnvironmentExpansionRequest): void {
    const nodes = this.store.nodes();
    const hostingEnvironment = nodes.find(n => n.id === req.nodeId);
    if (!hostingEnvironment) return;

    this.store.pushUndo();

    const currentHeight = hostingEnvironment.size.height;
    const collapsedHeight = this.hostingEnvironmentCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.hostingEnvironmentCollapsedHeights.has(req.nodeId)) {
      this.hostingEnvironmentCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.hostingEnvironmentCollapsedHeights.delete(req.nodeId);
    }

    // Stats panel rows are compact key/value lines plus panel chrome.
    const panelHeight = req.statCount === 0 ? 40 : req.statCount * 26 + 20;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = hostingEnvironment.metadata?.subscriptionId || '';
    const rg = hostingEnvironment.metadata?.resourceGroup || hostingEnvironment.groupId || '';
    const cutoffY = hostingEnvironment.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === hostingEnvironment.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onServerFarmExpansionChanged(req: ServerFarmExpansionRequest): void {
    const nodes = this.store.nodes();
    const serverFarm = nodes.find(n => n.id === req.nodeId);
    if (!serverFarm) return;

    this.store.pushUndo();

    const currentHeight = serverFarm.size.height;
    const collapsedHeight = this.serverFarmCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.serverFarmCollapsedHeights.has(req.nodeId)) {
      this.serverFarmCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.serverFarmCollapsedHeights.delete(req.nodeId);
    }

    const panelHeight = req.statCount === 0 ? 40 : req.statCount * 26 + 20;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = serverFarm.metadata?.subscriptionId || '';
    const rg = serverFarm.metadata?.resourceGroup || serverFarm.groupId || '';
    const cutoffY = serverFarm.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === serverFarm.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
  }

  onPublicIpExpansionChanged(req: PublicIpExpansionRequest): void {
    const nodes = this.store.nodes();
    const pip = nodes.find(n => n.id === req.nodeId);
    if (!pip) return;

    this.store.pushUndo();

    const currentHeight = pip.size.height;
    const collapsedHeight = this.publicIpCollapsedHeights.get(req.nodeId) ?? currentHeight;
    if (req.expanded && !this.publicIpCollapsedHeights.has(req.nodeId)) {
      this.publicIpCollapsedHeights.set(req.nodeId, currentHeight);
    }
    if (!req.expanded) {
      this.publicIpCollapsedHeights.delete(req.nodeId);
    }

    // Detail rows are compact key/value lines plus panel chrome.
    const panelHeight = req.detailCount === 0 ? 40 : req.detailCount * 24 + 20;
    const targetHeight = req.expanded
      ? Math.max(currentHeight, collapsedHeight + panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return;

    const subId = pip.metadata?.subscriptionId || '';
    const rg = pip.metadata?.resourceGroup || pip.groupId || '';
    const cutoffY = pip.position.y + currentHeight - 2;

    this.store.setNodes(nodes.map(n => {
      if (n.id === pip.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    }));
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
    this.store.pushUndo();
    this.store.setCustomContainerName(`${type}::${id}`, trimmed || null);
    this.renamingContainer = null;
    this.renamingValue = '';
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  cancelRename(): void {
    this.renamingContainer = null;
    this.renamingValue = '';
  }

  // ── Misc ───────────────────────────────────────────────────────────────────
  deleteSelectedNode(): void {
    const selectedNodeId = this.store.selectedNodeId();
    if (!selectedNodeId) return;
    this.store.pushUndo();
    this.store.deleteNode(selectedNodeId);
  }

  async toggleFinOps(): Promise<void> {
    await this.actions.toggleFinOps();
  }

  get finOpsCostedNodeCount(): number {
    return this.actions.finOpsCostedNodeCount;
  }

  get finOpsTopNodes(): Array<{ id: string; label: string; cost: number }> {
    return this.actions.finOpsTopNodes;
  }

  formatUsd(value: number): string {
    return this.actions.formatUsd(value);
  }

  toggleDrift(): void {
    this.actions.toggleDrift();
  }

  get finOpsLoading(): boolean { return this.actions.finOpsLoading; }
  get finOpsError(): string | null { return this.actions.finOpsError; }
  get finOpsLoadedSubscriptions(): number { return this.actions.finOpsLoadedSubscriptions; }

  openExportDialog(): void { this.exportDialogOpen = true; }
  closeExportDialog(): void { this.exportDialogOpen = false; }
  async doExport(): Promise<void> {
    if (!this.exportRootRef) return;
    this.exportBusy = true;
    try {
      await this.actions.exportImage(this.exportRootRef, {
        background: this.exportBg,
        embed: this.exportEmbed,
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight,
      });
    } finally {
      this.exportBusy = false;
      this.exportDialogOpen = false;
    }
  }

  exportJson(): void { this.actions.exportJson(); }
  async onImportFile(file: File): Promise<void> { await this.actions.onImportFile(file); }

  rescan(): void { this.actions.rescan(); }

  async relayoutCanvas(): Promise<void> {
    if (this.relayoutBusy) return;
    this.store.pushUndo();
    this.relayoutBusy = true;
    try {
      const currentNodes = this.store.nodes();

      // Run ELK with collapsed node heights so expanded panels don't distort spacing.
      // All collapsed-height maps track the pre-expansion height for each node type.
      const collapsedMaps = [
        this.routeTableCollapsedHeights,
        this.virtualNetworkCollapsedHeights,
        this.nsgCollapsedHeights,
        this.storageAccountCollapsedHeights,
        this.aksCollapsedHeights,
        this.vmDetailCollapsedHeights,
        this.uaiCollapsedHeights,
        this.hostingEnvironmentCollapsedHeights,
        this.serverFarmCollapsedHeights,
      ];

      const layoutNodes = currentNodes.map(node => {
        for (const map of collapsedMaps) {
          const h = map.get(node.id);
          if (h !== undefined) return { ...node, size: { ...node.size, height: h } };
        }
        return node;
      });

      const laid = await this.elkLayout.layout(layoutNodes, this.store.edges());

      // Apply only the positions from ELK back to the original nodes,
      // keeping expanded heights intact.
      const posById = new Map(laid.map(n => [n.id, n.position]));
      this.store.setNodes(currentNodes.map(n => {
        const pos = posById.get(n.id);
        return pos ? { ...n, position: pos } : n;
      }));
    } finally {
      this.relayoutBusy = false;
    }
  }

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

  private updateSelectedAnnotation(
    changes: Partial<Annotation>,
    allowedTypes?: Annotation['type'][],
  ): void {
    if (!this.selectedAnnotationId) return;
    const ann = this.annotationById(this.selectedAnnotationId);
    if (!ann) return;
    if (allowedTypes && !allowedTypes.includes(ann.type)) return;
    this.store.updateAnnotation(ann.id, changes);
  }

  private syncToolbarFromAnnotation(ann: Annotation): void {
    this.activeColor = ann.color;
    this.activeStrokeWidth = ann.strokeWidth;
    this.activeStrokeStyle = ann.strokeStyle ?? 'solid';
    this.activeSloppiness = ann.sloppiness ?? 0;
    this.activeEdgeRouting = ann.edgeRouting ?? 'straight';
    this.activeEdgeMode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
    this.activeFill = ann.fill ?? 'none';
    this.activeFillOpacity = ann.fillOpacity ?? 0.2;
  }

  private annotationMaxX(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') return Math.max(ann.x, ann.x2 ?? ann.x);
    if (ann.type === 'rect' || ann.type === 'diamond' || ann.type === 'ellipse') return ann.x + (ann.width ?? 0);
    if (ann.type === 'draw' && ann.pathData) return this.pathMax(ann.pathData).x;
    return ann.x + (ann.width ?? 200);
  }

  private annotationMaxY(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') return Math.max(ann.y, ann.y2 ?? ann.y);
    if (ann.type === 'rect' || ann.type === 'diamond' || ann.type === 'ellipse') return ann.y + (ann.height ?? 0);
    if (ann.type === 'draw' && ann.pathData) return this.pathMax(ann.pathData).y;
    return ann.y + (ann.height ?? 80);
  }

  private previewMaxX(): number {
    let maxX = 0;
    if (this.previewArrow) maxX = Math.max(maxX, this.previewArrow.x1, this.previewArrow.x2);
    if (this.previewLine) maxX = Math.max(maxX, this.previewLine.x1, this.previewLine.x2);
    if (this.previewRect) maxX = Math.max(maxX, this.previewRect.x + this.previewRect.w);
    if (this.previewDiamond) maxX = Math.max(maxX, this.previewDiamond.x + this.previewDiamond.w);
    if (this.previewEllipse) maxX = Math.max(maxX, this.previewEllipse.cx + this.previewEllipse.rx);
    for (const [x] of this.drawPoints) maxX = Math.max(maxX, x);
    return maxX;
  }

  private previewMaxY(): number {
    let maxY = 0;
    if (this.previewArrow) maxY = Math.max(maxY, this.previewArrow.y1, this.previewArrow.y2);
    if (this.previewLine) maxY = Math.max(maxY, this.previewLine.y1, this.previewLine.y2);
    if (this.previewRect) maxY = Math.max(maxY, this.previewRect.y + this.previewRect.h);
    if (this.previewDiamond) maxY = Math.max(maxY, this.previewDiamond.y + this.previewDiamond.h);
    if (this.previewEllipse) maxY = Math.max(maxY, this.previewEllipse.cy + this.previewEllipse.ry);
    for (const [, y] of this.drawPoints) maxY = Math.max(maxY, y);
    return maxY;
  }

  private pathMax(pathData: string): { x: number; y: number } {
    const nums = pathData.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) return { x: 0, y: 0 };
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) return { x: 0, y: 0 };
    return { x: maxX, y: maxY };
  }

  private currentDrawingRuntime(): DrawingRuntimeState {
    return {
      isDrawing: this.isDrawing,
      drawPoints: this.drawPoints,
      shapeStart: this.shapeStart,
      previewPath: this.previewPath,
      previewArrow: this.previewArrow,
      previewLine: this.previewLine,
      previewRect: this.previewRect,
      previewDiamond: this.previewDiamond,
      previewEllipse: this.previewEllipse,
    };
  }

  private currentDrawingStyle(): DrawingStyleState {
    return {
      activeTool: this.activeTool,
      activeColor: this.activeColor,
      activeStrokeWidth: this.activeStrokeWidth,
      activeStrokeStyle: this.activeStrokeStyle,
      activeSloppiness: this.activeSloppiness,
      activeEdgeRouting: this.activeEdgeRouting,
      activeEdgeMode: this.activeEdgeMode,
      activeFill: this.activeFill,
      activeFillOpacity: this.activeFillOpacity,
    };
  }

  private applyDrawingRuntime(next: DrawingRuntimeState): void {
    this.isDrawing = next.isDrawing;
    this.drawPoints = next.drawPoints;
    this.shapeStart = next.shapeStart;
    this.previewPath = next.previewPath;
    this.previewArrow = next.previewArrow;
    this.previewLine = next.previewLine;
    this.previewRect = next.previewRect;
    this.previewDiamond = next.previewDiamond;
    this.previewEllipse = next.previewEllipse;
  }
}
