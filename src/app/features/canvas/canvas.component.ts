import { Component, inject, effect, ViewChild, ElementRef, HostListener, computed, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import { AutosaveService } from '../../core/services/autosave.service';
import { buildDiagramState } from '../../core/services/export.service';
import {
  ContextMenuRequest,
  InternalItemMoveRequest,
  NodeResizeRequest,
  NodeRotateRequest,
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
  ScheduleExpansionRequest,
  DiskExpansionRequest,
  AzureFirewallExpansionRequest,
  ApplicationGatewayExpansionRequest,
  ConnectionExpansionRequest,
  DnsZoneExpansionRequest,
} from './diagram-node/diagram-node.contracts';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { DrawingToolbarComponent } from './drawing-toolbar/drawing-toolbar.component';
import { ResourceContextMenuComponent } from './context-menus/resource-context-menu.component';
import { AnnotationContextMenuComponent } from './context-menus/annotation-context-menu.component';
import { RgContextMenuComponent } from './context-menus/rg-context-menu.component';
import { MultiSelectContextMenuComponent } from './context-menus/multi-select-context-menu.component';
import { ResourceEditorModalComponent } from './resource-editor-modal.component';
import { CreateResourceModalComponent, ResourceCreationData } from './create-resource-modal.component';
import { ExportDialogComponent } from './export-dialog.component';
import { FinOpsInsightsPanelComponent } from './finops-insights-panel.component';
import { EdgeStylePanelComponent } from './edge-style-panel.component';
import { ZoomControlsComponent } from './zoom-controls.component';
import { MinimapComponent } from './minimap.component';
import { AnnotationEditOverlayComponent } from './annotation-edit-overlay.component';
import { CanvasSvgLayerComponent } from './layers/canvas-svg-layer.component';
import { CanvasContainersLayerComponent } from './layers/canvas-containers-layer.component';
import { CanvasNodesLayerComponent } from './layers/canvas-nodes-layer.component';
import { CanvasAnnotationOverlayLayerComponent } from './layers/canvas-annotation-overlay-layer.component';
import { CanvasContextMenuService } from './canvas-context-menu.service';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { Annotation, DrawingTool, StrokeStyle, EdgeRouting, EdgeMode } from '../../core/models/annotation.model';
import { DiagramEdge, EdgeStyle } from '../../core/models/diagram-edge.model';
import {
  RgBound,
  SubscriptionBound,
  VmBound,
  RouteTableBound,
  ResourceEditorDraft,
  SizeOffset,
  TagHighlightInfo,
  TagHighlightResizeDragState,
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
import { CanvasNodeExpansionService } from './canvas-node-expansion.service';
import { CanvasTagVisualizationService } from './canvas-tag-visualization.service';
import {
  annotationBounds as annotationBoundsUtil,
  annotationMaxX as annotationMaxXUtil,
  annotationMaxY as annotationMaxYUtil,
  annotationTextHeight as annotationTextHeightUtil,
  annotationTextWidth as annotationTextWidthUtil,
  edgeAnchorBetween,
} from './canvas-geometry.util';
import { DrawingRuntimeState, DrawingStyleState, onDrawEnd, onDrawMove, onDrawStart, resetDrawingRuntime } from './canvas-drawing.util';
import { normalizePastedImage, pasteTargetPosition as pasteTargetPositionUtil } from './canvas-image-paste.util';

const ZERO_OFFSET: SizeOffset = { top: 0, right: 0, bottom: 0, left: 0 };
const AZURE_RESOURCE_DND_TYPE = 'application/x-zuremap-azure-resource';
const CANVAS_COPY_OFFSET = 24;

interface NodeClipboardPayload {
  kind: 'node-set';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface AnnotationClipboardPayload {
  kind: 'annotation-set';
  annotations: Annotation[];
}

type CanvasClipboardPayload = NodeClipboardPayload | AnnotationClipboardPayload;

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ToolbarComponent,
    DrawingToolbarComponent,
    ResourceContextMenuComponent,
    AnnotationContextMenuComponent,
    RgContextMenuComponent,
    MultiSelectContextMenuComponent,
    ResourceEditorModalComponent,
    CreateResourceModalComponent,
    ExportDialogComponent,
    FinOpsInsightsPanelComponent,
    EdgeStylePanelComponent,
    ZoomControlsComponent,
    MinimapComponent,
    AnnotationEditOverlayComponent,
    CanvasSvgLayerComponent,
    CanvasContainersLayerComponent,
    CanvasNodesLayerComponent,
    CanvasAnnotationOverlayLayerComponent,
  ],
  templateUrl: "./canvas.component.html",
  styleUrl: "./canvas.component.scss",
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasHost', { read: ElementRef }) canvasHostRef!: ElementRef;
  @ViewChild('exportRoot', { read: ElementRef }) exportRootRef!: ElementRef;

  store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  protected iconRegistryService = inject(IconRegistryService);
  private actions = inject(CanvasActionsService);
  private edgeEditor = inject(CanvasEdgeEditorService);
  private resourceEditor = inject(CanvasResourceEditorService);
  private visibilitySvc = inject(CanvasVisibilityService);
  private collapseSvc = inject(CanvasCollapseService);
  private annotationSvc = inject(CanvasAnnotationService);
  private dragSvc = inject(CanvasDragService);
  private overlapSvc = inject(CanvasOverlapService);
  private nodeExpansion = inject(CanvasNodeExpansionService);
  private tagVisualization = inject(CanvasTagVisualizationService);
  private autosave = inject(AutosaveService);
  readonly ctxMenuSvc = inject(CanvasContextMenuService);
  readonly childToParentMap = computed(() => {
    const map = new Map<string, string>();
    for (const node of this.store.nodes()) {
      for (const childId of node.children ?? []) {
        map.set(childId, node.id);
      }
    }
    return map;
  });

  readonly parentLabelById = computed(() =>
    new Map(this.store.nodes().map(n => [n.id, n.label]))
  );

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
  tagHighlightResizeDrag: TagHighlightResizeDragState | null = null;

  /** All tag keys + their known values across all nodes, for autofill. */
  availableTags = new Map<string, Set<string>>();
  private collapsedResourceGroups = new Set<string>();
  private collapsedSubscriptions = new Set<string>();
  private collapsedVmGroups = new Set<string>();
  private collapsedRouteTableGroups = new Set<string>();
  private isResolvingRgOverlaps = false;
  private autosaveTimer: number | null = null;

  constructor() {
    effect(() => {
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      this.refreshVisibility(nodes, edges);
    });
    effect(() => {
      const revision = this.store.revision();
      if (!this.autosave.enabled() || revision === 0) return;
      if (this.autosaveTimer !== null) window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = window.setTimeout(() => {
        this.autosave.queueSave(buildDiagramState(
          this.store.nodes(),
          this.store.edges(),
          this.store.activeSubscriptions(),
          this.store.annotations(),
        ));
      }, 200);
    });
  }

  ngAfterViewInit(): void {
    const host = this.canvasHostRef?.nativeElement as HTMLElement | undefined;
    if (host) {
      this.minimapViewportWidth = host.clientWidth;
      this.minimapViewportHeight = host.clientHeight;
    }
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  // ── Drawing tool state ─────────────────────────────────────────────────────
  activeTool: DrawingTool = 'pointer';
  activeColor = '#1e1e1e';
  activeFontFamily = 'Arial, sans-serif';
  activeFontSize = 14;
  activeStrokeWidth = 2;
  activeStrokeStyle: StrokeStyle = 'solid';
  activeSloppiness = 0;
  activeEdgeRouting: EdgeRouting = 'straight';
  activeEdgeMode: EdgeMode = 'end';
  activeFill = 'none';
  activeFillOpacity = 0.2;

  // ── Minimap state ──────────────────────────────────────────────────────────
  minimapOpen = false;
  minimapScrollLeft = 0;
  minimapScrollTop = 0;
  minimapViewportWidth = 0;
  minimapViewportHeight = 0;

  onCanvasScroll(): void {
    const host = this.canvasHostRef?.nativeElement as HTMLElement | undefined;
    if (!host) return;
    this.minimapScrollLeft = host.scrollLeft;
    this.minimapScrollTop = host.scrollTop;
    this.minimapViewportWidth = host.clientWidth;
    this.minimapViewportHeight = host.clientHeight;
  }

  onMinimapPan(e: { scrollLeft: number; scrollTop: number }): void {
    const host = this.canvasHostRef?.nativeElement as HTMLElement | undefined;
    if (!host) return;
    host.scrollLeft = e.scrollLeft;
    host.scrollTop = e.scrollTop;
    this.minimapScrollLeft = host.scrollLeft;
    this.minimapScrollTop = host.scrollTop;
  }

  // ── Resource placement state ───────────────────────────────────────────────
  activeResourceType = '';
  showCreateResourceModal = false;
  resourcePlacementPosition: { x: number; y: number } | null = null;

  selectedAnnotationId: string | null = null;
  selectedAnnotationIds: string[] = [];
  editingAnnotation: Annotation | null = null;
  editingTextValue = '';
  private canvasClipboard: CanvasClipboardPayload | null = null;
  private pasteSequence = 0;

  // In-progress drawing previews
  previewPath = '';
  previewArrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewRect: { x: number; y: number; w: number; h: number } | null = null;
  previewDiamond: { x: number; y: number; w: number; h: number } | null = null;
  previewEllipse: { cx: number; cy: number; rx: number; ry: number } | null = null;

  // Internal drawing state
  private isDrawing = false;
  private drawPoints: [number, number][] = [];
  private shapeStart: { x: number; y: number } | null = null;

  // Annotation drag state
  private annDragId: string | null = null;
  private annDragMouse = { x: 0, y: 0 };
  private annDragOrigin: { x: number; y: number; x2?: number; y2?: number } = { x: 0, y: 0 };
  private imageResizeDrag: { annId: string; startX: number; startY: number; startWidth: number; startHeight: number; aspect: number } | null = null;
  private annShapeResizeDrag: { annId: string; handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'; startClientX: number; startClientY: number; startX: number; startY: number; startWidth: number; startHeight: number } | null = null;
  private annRotateDrag: { annId: string; cx: number; cy: number } | null = null;

  // RG mouse drag (smooth, incremental)
  rgDragState: RgDragState | null = null;
  get isRgDragging(): boolean { return this.rgDragState !== null; }
  subscriptionDragState: SubscriptionDragState | null = null;
  get isSubscriptionDragging(): boolean { return this.subscriptionDragState !== null; }
  vmDragState: VmDragState | null = null;
  get isVmDragging(): boolean { return this.vmDragState !== null; }

  // Individual node mouse drag
  nodeDragState: NodeDragState | null = null;

  // Marquee selection
  marqueeState: { startX: number; startY: number; currentX: number; currentY: number; ctrlHeld: boolean } | null = null;

  get marqueeRect(): { x: number; y: number; w: number; h: number } {
    if (!this.marqueeState) return { x: 0, y: 0, w: 0, h: 0 };
    const { startX, startY, currentX, currentY } = this.marqueeState;
    return {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      w: Math.abs(currentX - startX),
      h: Math.abs(currentY - startY),
    };
  }

  // Container rename
  renamingContainer: { type: 'rg' | 'sub' | 'vm' | 'rt'; id: string } | null = null;
  renamingValue = '';

  // Floating toolbar drag
  toolbarPos = { x: 12, y: 12 };
  toolbarDragState: ToolbarDragState | null = null;

  // Node HTML5 drag
  private dragOffset = { x: 0, y: 0 };
  private collapsedHeights = new Map<string, number>();
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
  dismissEmptyCanvasHint = false;

  get showEmptyCanvasHint(): boolean {
    return !this.dismissEmptyCanvasHint
      && this.store.canvasSessionMode() === 'empty'
      && this.store.nodes().length === 0;
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const copied = this.copySelectedCanvasObject();
      if (copied) e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (this.pasteCanvasClipboard()) {
        e.preventDefault();
      }
      return;
    }
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
    if ((e.key === 'Delete' || e.key === 'Backspace') && (this.selectedAnnotationId || this.selectedAnnotationIds.length > 0)) {
      e.preventDefault();
      this.deleteSelectedAnnotation();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedEdgeId) {
      e.preventDefault();
      this.deleteSelectedEdge();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.store.selectedNodeIds().length > 1) {
      e.preventDefault();
      this.store.pushUndo();
      this.store.deleteSelectedNodes();
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
      this.selectedAnnotationIds = [];
      this.selectedTagHighlightRuleId = null;
      if (this.editingAnnotation) this.cancelEdit();
      if (this.store.selectedNodeIds().length > 0) this.store.selectNodes([]);
    }
  }

  @HostListener('document:paste', ['$event'])
  async onPaste(event: ClipboardEvent): Promise<void> {
    if (this.activeTool !== 'pointer') return;
    if ((event.target as HTMLElement | null)?.matches('input,textarea,[contenteditable=true]')) return;
    const items = event.clipboardData?.items;
    if (!items?.length) return;

    const imageItem = Array.from(items).find(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    try {
      const processed = await normalizePastedImage(file);
      const position = pasteTargetPositionUtil(this.canvasHostRef?.nativeElement, this.zoomLevel, processed.width, processed.height);
      const annotation: Annotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        color: '#1e1e1e',
        strokeWidth: 1,
        fill: 'none',
        x: position.x,
        y: position.y,
        width: processed.width,
        height: processed.height,
        imageDataUrl: processed.dataUrl,
      };

      this.store.pushUndo();
      this.store.addAnnotation(annotation);
      this.selectedAnnotationId = annotation.id;
      this.selectedAnnotationIds = [annotation.id];
      this.syncToolbarFromAnnotation(annotation);
    } catch (err) {
      console.warn('[ZureMap] Failed to paste image annotation:', err);
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

    if (this.annShapeResizeDrag) {
      const drag = this.annShapeResizeDrag;
      const rawDx = (e.clientX - drag.startClientX) / this.zoomLevel;
      const rawDy = (e.clientY - drag.startClientY) / this.zoomLevel;
      const MIN = 20;
      let { startX: x, startY: y, startWidth: w, startHeight: h } = drag;
      switch (drag.handle) {
        case 'se': w = Math.max(MIN, drag.startWidth + rawDx); h = Math.max(MIN, drag.startHeight + rawDy); break;
        case 's':  h = Math.max(MIN, drag.startHeight + rawDy); break;
        case 'e':  w = Math.max(MIN, drag.startWidth + rawDx); break;
        case 'nw': w = Math.max(MIN, drag.startWidth - rawDx); h = Math.max(MIN, drag.startHeight - rawDy);
                   x = drag.startX + drag.startWidth - w; y = drag.startY + drag.startHeight - h; break;
        case 'n':  h = Math.max(MIN, drag.startHeight - rawDy); y = drag.startY + drag.startHeight - h; break;
        case 'ne': w = Math.max(MIN, drag.startWidth + rawDx); h = Math.max(MIN, drag.startHeight - rawDy);
                   y = drag.startY + drag.startHeight - h; break;
        case 'sw': w = Math.max(MIN, drag.startWidth - rawDx); x = drag.startX + drag.startWidth - w;
                   h = Math.max(MIN, drag.startHeight + rawDy); break;
        case 'w':  w = Math.max(MIN, drag.startWidth - rawDx); x = drag.startX + drag.startWidth - w; break;
      }
      this.store.updateAnnotation(drag.annId, { x, y, width: w, height: h });
      return;
    }

    if (this.annRotateDrag) {
      const drag = this.annRotateDrag;
      const pt = this.svgPoint(e);
      const angleDeg = (Math.atan2(pt.y - drag.cy, pt.x - drag.cx) * 180) / Math.PI + 90;
      this.store.updateAnnotation(drag.annId, { rotation: Math.round(angleDeg) });
      return;
    }

    if (this.imageResizeDrag) {
      const drag = this.imageResizeDrag;
      const dx = (e.clientX - drag.startX) / this.zoomLevel;
      const dy = (e.clientY - drag.startY) / this.zoomLevel;
      const delta = Math.max(dx, dy * drag.aspect);
      const nextWidth = Math.max(60, drag.startWidth + delta);
      const nextHeight = Math.max(40, nextWidth / drag.aspect);
      this.store.updateAnnotation(drag.annId, {
        width: nextWidth,
        height: nextHeight,
      });
      return;
    }

    if (this.marqueeState) {
      const host = this.canvasHostRef?.nativeElement as HTMLElement;
      const rect = host?.getBoundingClientRect();
      const scrollLeft = host?.scrollLeft ?? 0;
      const scrollTop = host?.scrollTop ?? 0;
      const canvasX = (e.clientX - (rect?.left ?? 0) + scrollLeft) / this.zoomLevel;
      const canvasY = (e.clientY - (rect?.top ?? 0) + scrollTop) / this.zoomLevel;
      this.marqueeState = { ...this.marqueeState, currentX: canvasX, currentY: canvasY };
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
      moveNodes: moves => this.store.moveNodes(moves),
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
    if (this.marqueeState) {
      const { x, y, w, h } = this.marqueeRect;
      if (w > 4 || h > 4) {
        const intersected = this.store.nodes()
          .filter(n =>
            n.position.x + (n.size?.width ?? 80) > x &&
            n.position.x < x + w &&
            n.position.y + (n.size?.height ?? 60) > y &&
            n.position.y < y + h
          )
          .map(n => n.id);
        const intersectedAnnotations = this.store.annotations()
          .filter(a => {
            const b = annotationBoundsUtil(a);
            return b.maxX > x && b.minX < x + w && b.maxY > y && b.minY < y + h;
          })
          .map(a => a.id);
        if (this.marqueeState.ctrlHeld) {
          const existing = this.store.selectedNodeIds();
          const merged = Array.from(new Set([...existing, ...intersected]));
          this.store.selectNodes(merged);
          this.selectedAnnotationIds = Array.from(new Set([...this.selectedAnnotationIds, ...intersectedAnnotations]));
        } else {
          this.store.selectNodes(intersected);
          this.selectedAnnotationIds = intersectedAnnotations;
        }
        this.selectedAnnotationId = this.selectedAnnotationIds[0] ?? null;
        if (this.selectedAnnotationId) {
          const selectedAnnotation = this.annotationById(this.selectedAnnotationId);
          if (selectedAnnotation) this.syncToolbarFromAnnotation(selectedAnnotation);
        }
      }
      this.marqueeState = null;
    }

    this.toolbarDragState = null;
    this.subscriptionDragState = null;
    this.vmDragState = null;
    this.rgDragState = null;
    this.nodeDragState = null;
    this.annDragId = null;
    this.edgeWaypointDragState = null;
    this.annWaypointDragState = null;
    this.imageResizeDrag = null;
    this.annShapeResizeDrag = null;
    this.annRotateDrag = null;
  }

  // ── Tool management ────────────────────────────────────────────────────────
  setTool(tool: DrawingTool): void {
    this.activeTool = tool;
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.selectedEdgeId = null;
    this.applyDrawingRuntime(resetDrawingRuntime(this.currentDrawingRuntime()));
  }

  onResourceTypeChange(type: string): void {
    this.activeResourceType = type;
  }

  onCanvasDragOver(event: DragEvent): void {
    if (!event.dataTransfer) return;
    if (!event.dataTransfer.types.includes(AZURE_RESOURCE_DND_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  onCanvasDrop(event: DragEvent): void {
    if (!event.dataTransfer) return;
    const raw = event.dataTransfer.getData(AZURE_RESOURCE_DND_TYPE);
    if (!raw) return;
    let payload: { type?: string; label?: string } | null = null;
    try {
      payload = JSON.parse(raw) as { type?: string; label?: string };
    } catch {
      return;
    }
    if (!payload?.type) return;
    event.preventDefault();
    const pos = this.canvasPointFromClient(event.clientX, event.clientY);
    this.startResourcePlacement(payload.type, pos);
  }

  onCreateResourceConfirm(data: ResourceCreationData): void {
    if (!this.resourcePlacementPosition || !this.activeResourceType) return;
    const iconUrl = this.iconRegistryService.getIconUrl(this.activeResourceType);
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const pos = this.resourcePlacementPosition;
    const tags: Record<string, string> = {};
    for (const t of data.tags) {
      if (t.key.trim()) tags[t.key.trim()] = t.value;
    }
    const node: DiagramNode = {
      id,
      label: data.name,
      resourceType: this.activeResourceType,
      iconUrl,
      group: 'standalone',
      groupId: data.resourceGroup || 'custom',
      position: pos,
      size: { width: 160, height: 80 },
      status: data.status,
      selected: false,
      highlighted: false,
      metadata: {
        id: `/custom/${data.resourceGroup || 'custom'}/${this.activeResourceType}/${data.name}`,
        name: data.name,
        type: this.activeResourceType,
        location: data.location,
        resourceGroup: data.resourceGroup,
        subscriptionId: 'custom',
        tags,
        properties: {},
      },
      custom: {
        description: data.description,
        internalItems: data.internalItems
          .filter(i => i.text.trim())
          .map((item, i) => ({ id: `ii-${i}`, text: item.text, x: 4, y: 20 + i * 16 })),
      },
    };
    this.store.pushUndo();
    this.store.appendNode(node);
    this.showCreateResourceModal = false;
    this.resourcePlacementPosition = null;
    this.setTool('pointer');
  }

  onCreateResourceCancel(): void {
    this.showCreateResourceModal = false;
    this.resourcePlacementPosition = null;
    this.setTool('pointer');
  }

  onToolbarColorChange(color: string): void {
    this.activeColor = color;
    this.updateSelectedAnnotation({ color });
  }

  onToolbarFontFamilyChange(fontFamily: string): void {
    this.activeFontFamily = fontFamily;
    this.updateSelectedAnnotation({ fontFamily }, ['text', 'sticky']);
  }

  onToolbarFontSizeChange(fontSize: number): void {
    this.activeFontSize = fontSize;
    this.updateSelectedAnnotation({ fontSize }, ['text', 'sticky']);
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
    if (this.activeTool === 'resource') {
      const pt = this.svgPoint(e);
      this.startResourcePlacement(this.activeResourceType, pt);
      return;
    }
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
    if (e.button !== 0) return;
    // Prefer node interactions when an annotation overlaps a node in screen space.
    const canvasPt = this.canvasPointFromClient(e.clientX, e.clientY);
    const nodeUnder = this.nodeAtCanvasPoint(canvasPt.x, canvasPt.y);
    if (nodeUnder) {
      this.onNodeMouseDown(e, nodeUnder);
      return;
    }
    e.stopPropagation();
    this.ctxMenuSvc.annotationContextMenu = null;
    this.ctxMenuSvc.contextMenu = null;
    this.selectedEdgeId = null;
    if (e.ctrlKey || e.metaKey) {
      if (this.selectedAnnotationIds.includes(ann.id)) {
        this.selectedAnnotationIds = this.selectedAnnotationIds.filter(id => id !== ann.id);
      } else {
        this.selectedAnnotationIds = [...this.selectedAnnotationIds, ann.id];
      }
      this.selectedAnnotationId = this.selectedAnnotationIds[0] ?? null;
      if (this.selectedAnnotationId) {
        const selected = this.annotationById(this.selectedAnnotationId);
        if (selected) this.syncToolbarFromAnnotation(selected);
      }
      return;
    }
    this.selectedAnnotationId = ann.id;
    this.selectedAnnotationIds = [ann.id];
    this.syncToolbarFromAnnotation(ann);
    const pt = this.svgPoint(e);
    this.store.pushUndo();
    this.annDragId = ann.id;
    this.annDragMouse = { x: pt.x, y: pt.y };
    this.annDragOrigin = { x: ann.x, y: ann.y, x2: ann.x2, y2: ann.y2 };
  }

  onImageResizeMouseDown(e: MouseEvent, ann: Annotation): void {
    if (this.activeTool !== 'pointer') return;
    e.preventDefault();
    e.stopPropagation();
    const width = Math.max(1, ann.width ?? 240);
    const height = Math.max(1, ann.height ?? 180);
    this.store.pushUndo();
    this.imageResizeDrag = {
      annId: ann.id,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: width,
      startHeight: height,
      aspect: width / height,
    };
  }

  onAnnotationShapeResizeMouseDown(e: MouseEvent, ann: Annotation, handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'): void {
    if (this.activeTool !== 'pointer') return;
    e.preventDefault();
    e.stopPropagation();
    this.store.pushUndo();
    this.annShapeResizeDrag = {
      annId: ann.id,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: ann.x,
      startY: ann.y,
      startWidth: ann.width ?? annotationTextWidthUtil(ann),
      startHeight: ann.height ?? annotationTextHeightUtil(ann),
    };
  }

  onAnnotationRotateMouseDown(e: MouseEvent, ann: Annotation): void {
    if (this.activeTool !== 'pointer') return;
    e.preventDefault();
    e.stopPropagation();
    this.store.pushUndo();
    const width = annotationTextWidthUtil(ann);
    const height = annotationTextHeightUtil(ann);
    this.annRotateDrag = {
      annId: ann.id,
      cx: ann.x + width / 2,
      cy: ann.y + height / 2,
    };
  }

  startEditAnnotation(ann: Annotation): void {
    this.editingAnnotation = ann;
    this.editingTextValue = ann.text ?? '';
  }

  finishEdit(nextText?: string): void {
    if (!this.editingAnnotation) return;
    if (typeof nextText === 'string') this.editingTextValue = nextText;
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

  private pasteOffset(): { x: number; y: number } {
    this.pasteSequence += 1;
    const delta = this.pasteSequence * CANVAS_COPY_OFFSET;
    return { x: delta, y: delta };
  }

  private nextNodeId(): string {
    return `copy-node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private nextEdgeId(): string {
    return `copy-edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private nextAnnotationId(): string {
    return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private pasteAnnotationsFromClipboard(sourceAnnotations: Annotation[]): void {
    const offset = this.pasteOffset();
    const pasted = sourceAnnotations.map(source => ({
      ...source,
      id: this.nextAnnotationId(),
      x: source.x + offset.x,
      y: source.y + offset.y,
      x2: typeof source.x2 === 'number' ? source.x2 + offset.x : source.x2,
      y2: typeof source.y2 === 'number' ? source.y2 + offset.y : source.y2,
      waypoints: source.waypoints?.map(w => ({ x: w.x + offset.x, y: w.y + offset.y })),
    }));
    if (pasted.length === 0) return;
    this.store.pushUndo();
    this.store.setAnnotations([...this.store.annotations(), ...pasted]);
    this.store.selectNodes([]);
    this.selectedAnnotationIds = pasted.map(a => a.id);
    this.selectedAnnotationId = pasted[0]?.id ?? null;
    this.selectedEdgeId = null;
    this.syncToolbarFromAnnotation(pasted[0]);
  }

  private pasteNodesFromClipboard(sourceNodes: DiagramNode[], sourceEdges: DiagramEdge[]): void {
    const offset = this.pasteOffset();
    const nodeIdMap = new Map<string, string>();
    for (const node of sourceNodes) nodeIdMap.set(node.id, this.nextNodeId());

    const pastedNodes = sourceNodes.map(source => {
      const newId = nodeIdMap.get(source.id)!;
      const remappedParentId = source.parentId ? nodeIdMap.get(source.parentId) ?? source.parentId : source.parentId;
      const remappedChildren = source.children?.map(c => nodeIdMap.get(c) ?? c);
      const groupId = source.group === 'standalone' ? newId : source.groupId;
      return {
        ...source,
        id: newId,
        parentId: remappedParentId,
        children: remappedChildren,
        groupId,
        selected: false,
        highlighted: false,
        position: { x: source.position.x + offset.x, y: source.position.y + offset.y },
        metadata: {
          ...source.metadata,
          id: `${source.metadata.id}-copy-${Date.now()}`,
          tags: source.metadata?.tags ? { ...source.metadata.tags } : {},
          properties: source.metadata?.properties ? { ...source.metadata.properties } : {},
        },
        custom: source.custom ? {
          ...source.custom,
          internalItems: source.custom.internalItems?.map(i => ({ ...i })),
        } : undefined,
      } as DiagramNode;
    });

    const pastedEdges = sourceEdges
      .map(source => {
        const mappedSourceId = nodeIdMap.get(source.sourceId);
        const mappedTargetId = nodeIdMap.get(source.targetId);
        if (!mappedSourceId || !mappedTargetId) return null;
        return {
          ...source,
          id: this.nextEdgeId(),
          sourceId: mappedSourceId,
          targetId: mappedTargetId,
          style: { ...source.style },
          waypoints: source.waypoints?.map(w => ({ x: w.x + offset.x, y: w.y + offset.y })),
        } as DiagramEdge;
      })
      .filter((edge): edge is DiagramEdge => edge !== null);

    if (pastedNodes.length === 0) return;
    this.store.pushUndo();
    this.store.setNodes([...this.store.nodes(), ...pastedNodes]);
    this.store.setEdges([...this.store.edges(), ...pastedEdges]);
    this.store.selectNodes(pastedNodes.map(n => n.id));
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.selectedEdgeId = null;
  }

  deleteSelectedAnnotation(): void {
    const ids = this.selectedAnnotationIds.length
      ? this.selectedAnnotationIds
      : (this.selectedAnnotationId ? [this.selectedAnnotationId] : []);
    if (!ids.length) return;
    this.store.pushUndo();
    const idSet = new Set(ids);
    this.store.setAnnotations(this.store.annotations().filter(a => !idSet.has(a.id)));
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
  }

  deleteSelectedEdge(): void {
    if (!this.selectedEdgeId) return;
    this.store.pushUndo();
    const selectedEdgeId = this.selectedEdgeId;
    this.store.setEdges(this.store.edges().filter(edge => edge.id !== selectedEdgeId));
    this.selectedEdgeId = null;
  }

  duplicateSelectedAnnotation(): void {
    if (!this.selectedAnnotationId) return;
    const source = this.annotationById(this.selectedAnnotationId);
    if (!source) return;
    const duplicated = this.annotationSvc.duplicate(source);
    this.store.pushUndo();
    this.store.addAnnotation(duplicated);
    this.selectedAnnotationId = duplicated.id;
    this.selectedAnnotationIds = [duplicated.id];
    this.syncToolbarFromAnnotation(duplicated);
  }

  bringSelectedAnnotationToFront(): void {
    if (!this.selectedAnnotationId) return;
    const selectedId = this.selectedAnnotationId;
    this.store.pushUndo();
    this.store.setAnnotations(this.annotationSvc.bringToFront(this.store.annotations(), selectedId));
  }

  sendSelectedAnnotationToBack(): void {
    if (!this.selectedAnnotationId) return;
    const selectedId = this.selectedAnnotationId;
    this.store.pushUndo();
    this.store.setAnnotations(this.annotationSvc.sendToBack(this.store.annotations(), selectedId));
  }

  clearAllAnnotations(): void {
    if (this.store.annotations().length === 0) return;
    const shouldClear = confirm('Clear all annotations from this diagram?');
    if (!shouldClear) return;
    this.store.pushUndo();
    this.store.clearAnnotations();
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
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

  get selectedAnnotationForDelete(): Annotation | null {
    if (!this.selectedAnnotationId || this.activeTool !== 'pointer') return null;
    return this.annotationById(this.selectedAnnotationId) ?? null;
  }

  get canEditSelectedTextStyle(): boolean {
    if (!this.selectedAnnotationId) return false;
    const ann = this.annotationById(this.selectedAnnotationId);
    return ann?.type === 'text' || ann?.type === 'sticky';
  }

  get canEditSelectedFillStyle(): boolean {
    if (!this.selectedAnnotationId) return false;
    const ann = this.annotationById(this.selectedAnnotationId);
    return ann?.type === 'rect' || ann?.type === 'ellipse' || ann?.type === 'diamond';
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
      maxX = Math.max(maxX, annotationMaxXUtil(ann) + 80);
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
      maxY = Math.max(maxY, annotationMaxYUtil(ann) + 80);
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

  selectTagHighlight(ruleId: string, event: Event): void {
    event.stopPropagation();
    this.selectedTagHighlightRuleId = ruleId;
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.store.selectNodes([]);
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
    if (event.button !== 0) return;
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
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.selectedEdgeId = null;

    if (event.ctrlKey || event.metaKey) {
      this.store.toggleNodeInSelection(node.id);
      return;
    }

    if (!this.store.selectedNodeIds().includes(node.id)) {
      this.store.selectNodes([node.id]);
    }
    this.store.pushUndo();
    this.nodeDragState = { id: node.id, ids: this.store.selectedNodeIds(), lastX: event.clientX, lastY: event.clientY, hasMoved: false };
  }

  onCanvasBackgroundMouseDown(event: MouseEvent): void {
    if (this.activeTool !== 'pointer') return;
    if (event.button !== 0) return;
    this.closeContextMenu();
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.selectedEdgeId = null;

    const host = this.canvasHostRef?.nativeElement as HTMLElement;
    const rect = host?.getBoundingClientRect();
    const scrollLeft = host?.scrollLeft ?? 0;
    const scrollTop = host?.scrollTop ?? 0;
    const canvasX = (event.clientX - (rect?.left ?? 0) + scrollLeft) / this.zoomLevel;
    const canvasY = (event.clientY - (rect?.top ?? 0) + scrollTop) / this.zoomLevel;

    if (!(event.ctrlKey || event.metaKey)) {
      this.store.selectNodes([]);
    }

    this.marqueeState = { startX: canvasX, startY: canvasY, currentX: canvasX, currentY: canvasY, ctrlHeld: event.ctrlKey || event.metaKey };
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

  private startResourcePlacement(type: string, position: { x: number; y: number }): void {
    if (!type) return;
    this.activeResourceType = type;
    this.resourcePlacementPosition = position;
    this.showCreateResourceModal = true;
  }

  private canvasPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const host = this.canvasHostRef?.nativeElement as HTMLElement | undefined;
    if (!host) return { x: 0, y: 0 };
    const rect = host.getBoundingClientRect();
    return {
      x: (clientX - rect.left + host.scrollLeft) / this.zoomLevel,
      y: (clientY - rect.top + host.scrollTop) / this.zoomLevel,
    };
  }

  private nodeAtCanvasPoint(canvasX: number, canvasY: number): DiagramNode | undefined {
    for (let i = this.visibleNodes.length - 1; i >= 0; i--) {
      const node = this.visibleNodes[i];
      if (
        canvasX >= node.position.x &&
        canvasX <= node.position.x + node.size.width &&
        canvasY >= node.position.y &&
        canvasY <= node.position.y + node.size.height
      ) {
        return node;
      }
    }
    return undefined;
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
    this.selectedAnnotationIds = [];
    this.store.selectNode(null);
    this.selectedEdgeId = edge.id;
  }

  // ── Edge markers (used only in <defs> in canvas.component.html) ──────────
  edgeMarkerColors(): string[] {
    const colors = new Set<string>();
    for (const edge of this.visibleEdges) {
      if (edge.style.markerEnd === 'arrow') colors.add(edge.style.strokeColor);
    }
    return Array.from(colors).sort();
  }

  edgeMarkerId(color: string): string {
    return `edge-arrow-${color.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  annMarkerColors(): string[] {
    const colors = new Set<string>();
    for (const ann of this.store.annotations()) {
      if (ann.type === 'arrow' || ann.type === 'line') {
        const mode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
        if (mode !== 'none') colors.add(ann.color);
      }
    }
    if (this.activeEdgeMode !== 'none') colors.add(this.activeColor);
    return Array.from(colors).sort();
  }

  annMarkerId(color: string): string {
    return `ann-arrow-${color.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
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

  // ── Context menu ──────────────────────────────────────────────────────────
  onContextMenuRequested(req: ContextMenuRequest): void {
    this.ctxMenuSvc.onContextMenuRequested(req);
  }

  onRgContextMenu(event: MouseEvent, rg: RgBound): void {
    this.ctxMenuSvc.onRgContextMenu(event, rg, this.activeTool);
  }

  onAnnotationContextMenu(event: MouseEvent, ann: Annotation): void {
    if (this.activeTool !== 'pointer') return;
    const canvasPt = this.canvasPointFromClient(event.clientX, event.clientY);
    const nodeUnder = this.nodeAtCanvasPoint(canvasPt.x, canvasPt.y);
    if (nodeUnder) {
      event.preventDefault();
      event.stopPropagation();
      this.ctxMenuSvc.onContextMenuRequested({ nodeId: nodeUnder.id, x: event.clientX, y: event.clientY });
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.ctxMenuSvc.contextMenu = null;
    this.ctxMenuSvc.rgContextMenu = null;
    this.ctxMenuSvc.multiSelectContextMenu = null;
    this.selectedEdgeId = null;
    this.store.selectNode(null);
    this.selectedAnnotationId = ann.id;
    this.selectedAnnotationIds = [ann.id];
    this.syncToolbarFromAnnotation(ann);
    this.ctxMenuSvc.annotationContextMenu = { x: event.clientX, y: event.clientY, annotationId: ann.id };
  }

  closeContextMenu(): void {
    this.ctxMenuSvc.closeContextMenu();
  }

  get canPasteAnyObject(): boolean {
    return this.canvasClipboard !== null;
  }

  get canPasteNodeObjects(): boolean {
    return this.canvasClipboard?.kind === 'node-set';
  }

  copySelectedCanvasObject(): boolean {
    if (this.ctxMenuSvc.annotationContextMenu) {
      const ann = this.annotationById(this.ctxMenuSvc.annotationContextMenu.annotationId);
      if (!ann) return false;
      this.canvasClipboard = { kind: 'annotation-set', annotations: [{ ...ann, waypoints: ann.waypoints?.map(w => ({ ...w })) }] };
      return true;
    }
    if (this.ctxMenuSvc.contextMenu) {
      this.store.selectNodes([this.ctxMenuSvc.contextMenu.nodeId]);
      this.selectedAnnotationId = null;
      this.selectedAnnotationIds = [];
    }

    const selectedAnnotationIds = this.selectedAnnotationIds.length
      ? this.selectedAnnotationIds
      : (this.selectedAnnotationId ? [this.selectedAnnotationId] : []);
    if (selectedAnnotationIds.length > 0) {
      const selectedIdSet = new Set(selectedAnnotationIds);
      const annotations = this.store.annotations()
        .filter(a => selectedIdSet.has(a.id))
        .map(a => ({ ...a, waypoints: a.waypoints ? a.waypoints.map(w => ({ ...w })) : undefined }));
      if (annotations.length === 0) return false;
      this.canvasClipboard = { kind: 'annotation-set', annotations };
      return true;
    }

    const selectedNodeIds = this.store.selectedNodeIds();
    if (selectedNodeIds.length === 0) return false;
    const nodeIdSet = new Set(selectedNodeIds);
    const nodes = this.store.nodes()
      .filter(n => nodeIdSet.has(n.id))
      .map(n => ({
        ...n,
        position: { ...n.position },
        size: { ...n.size },
        children: n.children ? [...n.children] : undefined,
        metadata: {
          ...n.metadata,
          tags: n.metadata?.tags ? { ...n.metadata.tags } : {},
          properties: n.metadata?.properties ? { ...n.metadata.properties } : {},
        },
        custom: n.custom ? {
          ...n.custom,
          internalItems: n.custom.internalItems?.map(i => ({ ...i })),
        } : undefined,
      }));
    const edges = this.store.edges()
      .filter(e => nodeIdSet.has(e.sourceId) && nodeIdSet.has(e.targetId))
      .map(e => ({
        ...e,
        style: { ...e.style },
        waypoints: e.waypoints ? e.waypoints.map(w => ({ ...w })) : undefined,
      }));
    this.canvasClipboard = { kind: 'node-set', nodes, edges };
    return true;
  }

  pasteCanvasClipboard(): boolean {
    if (!this.canvasClipboard) return false;
    if (this.canvasClipboard.kind === 'annotation-set') {
      this.pasteAnnotationsFromClipboard(this.canvasClipboard.annotations);
      this.closeContextMenu();
      return true;
    }
    this.pasteNodesFromClipboard(this.canvasClipboard.nodes, this.canvasClipboard.edges);
    this.closeContextMenu();
    return true;
  }

  async ctxRgAutoLayout(): Promise<void> {
    await this.ctxMenuSvc.ctxRgAutoLayout();
  }

  ctxDelete(): void {
    this.ctxMenuSvc.ctxDelete();
  }

  ctxMultiDelete(): void {
    this.ctxMenuSvc.ctxMultiDelete();
  }

  ctxMultiCopyNames(): void {
    this.ctxMenuSvc.ctxMultiCopyNames();
  }

  ctxMultiDetachAll(): void {
    this.ctxMenuSvc.ctxMultiDetachAll();
  }

  ctxCopyName(): void {
    this.ctxMenuSvc.ctxCopyName();
  }

  ctxCopyResourceId(): void {
    this.ctxMenuSvc.ctxCopyResourceId();
  }

  ctxFocus(): void {
    this.ctxMenuSvc.ctxFocus();
  }

  breakOutNode(nodeId: string, parentId: string | null): void {
    this.store.pushUndo();
    if (parentId) {
      this.store.detachNodeFromParent(nodeId, parentId);
      return;
    }
    this.store.detachNodeFromResourceGroup(nodeId);
  }

  canDetachFromResourceGroup(node: DiagramNode): boolean {
    return node.group === 'resourceGroup';
  }

  parentLabelForNode(node: DiagramNode): string | null {
    const parentId = this.childToParentMap().get(node.id);
    if (parentId) return this.parentLabelById().get(parentId) ?? 'container';
    if (this.canDetachFromResourceGroup(node)) return node.metadata?.resourceGroup || node.groupId || 'resource group';
    return null;
  }

  canResetBreakout(node: DiagramNode): boolean {
    return this.ctxMenuSvc.canResetBreakout(node);
  }

  resetBreakoutLabel(node: DiagramNode): string {
    return this.ctxMenuSvc.resetBreakoutLabel(node);
  }

  resetBreakout(node: DiagramNode): void {
    this.ctxMenuSvc.resetBreakout(node);
  }

  ctxResetBreakout(): void {
    this.ctxMenuSvc.ctxResetBreakout();
  }

  ctxDetachFromParent(): void {
    this.ctxMenuSvc.ctxDetachFromParent();
  }

  ctxVisualizeTags(): void {
    this.ctxMenuSvc.ctxVisualizeTags();
  }

  ctxAnnDuplicate(): void {
    if (!this.ctxMenuSvc.annotationContextMenu) return;
    this.selectedAnnotationId = this.ctxMenuSvc.annotationContextMenu.annotationId;
    this.selectedAnnotationIds = [this.ctxMenuSvc.annotationContextMenu.annotationId];
    this.duplicateSelectedAnnotation();
    this.closeContextMenu();
  }

  ctxAnnBringFront(): void {
    if (!this.ctxMenuSvc.annotationContextMenu) return;
    this.selectedAnnotationId = this.ctxMenuSvc.annotationContextMenu.annotationId;
    this.selectedAnnotationIds = [this.ctxMenuSvc.annotationContextMenu.annotationId];
    this.bringSelectedAnnotationToFront();
    this.closeContextMenu();
  }

  ctxAnnSendBack(): void {
    if (!this.ctxMenuSvc.annotationContextMenu) return;
    this.selectedAnnotationId = this.ctxMenuSvc.annotationContextMenu.annotationId;
    this.selectedAnnotationIds = [this.ctxMenuSvc.annotationContextMenu.annotationId];
    this.sendSelectedAnnotationToBack();
    this.closeContextMenu();
  }

  ctxAnnCopyText(): void {
    if (!this.ctxMenuSvc.annotationContextMenu) return;
    const ann = this.annotationById(this.ctxMenuSvc.annotationContextMenu.annotationId);
    if (!ann?.text) return;
    navigator.clipboard.writeText(ann.text);
    this.closeContextMenu();
  }

  ctxAnnEditText(): void {
    if (!this.ctxMenuSvc.annotationContextMenu) return;
    const ann = this.annotationById(this.ctxMenuSvc.annotationContextMenu.annotationId);
    if (!ann || (ann.type !== 'text' && ann.type !== 'sticky')) return;
    this.startEditAnnotation(ann);
    this.closeContextMenu();
  }

  ctxAnnDelete(): void {
    if (!this.ctxMenuSvc.annotationContextMenu) return;
    this.store.pushUndo();
    this.store.deleteAnnotation(this.ctxMenuSvc.annotationContextMenu.annotationId);
    if (this.selectedAnnotationId === this.ctxMenuSvc.annotationContextMenu.annotationId) this.selectedAnnotationId = null;
    this.selectedAnnotationIds = this.selectedAnnotationIds.filter(id => id !== this.ctxMenuSvc.annotationContextMenu!.annotationId);
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
    let nodes = this.store.nodes().map(n => {
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
    });
    nodes = this.pushSiblings(nodes, req.nodeId);
    this.store.setNodes(nodes);
  }

  onNodeRotated(req: NodeRotateRequest): void {
    this.store.setNodes(
      this.store.nodes().map(n =>
        n.id === req.nodeId ? { ...n, angle: req.angle } : n,
      ),
    );
  }

  private getSiblings(nodes: DiagramNode[], node: DiagramNode): DiagramNode[] {
    if (node.parentId) {
      return nodes.filter(n => n.id !== node.id && n.parentId === node.parentId);
    }
    return nodes.filter(n => n.id !== node.id && n.groupId === node.groupId && !n.parentId);
  }

  private pushSiblings(nodes: DiagramNode[], resizedNodeId: string): DiagramNode[] {
    const PUSH_GAP = 16;
    const MAX_PASSES = 20;

    const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));
    const resized = nodeMap.get(resizedNodeId);
    if (!resized) return nodes;

    const allSiblingIds = new Set(this.getSiblings(nodes, resized).map(s => s.id));
    if (allSiblingIds.size === 0) return nodes;

    // movers: nodes whose new position may be pushing others
    let movers = [resizedNodeId];

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const nextMovers: string[] = [];
      let anyMoved = false;

      for (const moverId of movers) {
        const mover = nodeMap.get(moverId)!;
        const moverRight = mover.position.x + mover.size.width;
        const moverBottom = mover.position.y + mover.size.height;

        const candidateIds = moverId === resizedNodeId
          ? allSiblingIds
          : new Set(this.getSiblings([...nodeMap.values()], mover).map(s => s.id));

        for (const sibId of candidateIds) {
          const sib = nodeMap.get(sibId);
          if (!sib) continue;

          const overlapX = moverRight + PUSH_GAP > sib.position.x && mover.position.x < sib.position.x + sib.size.width;
          const overlapY = moverBottom + PUSH_GAP > sib.position.y && mover.position.y < sib.position.y + sib.size.height;
          if (!overlapX || !overlapY) continue;

          const sibCenterX = sib.position.x + sib.size.width / 2;
          const sibCenterY = sib.position.y + sib.size.height / 2;
          const moverCenterX = mover.position.x + mover.size.width / 2;
          const moverCenterY = mover.position.y + mover.size.height / 2;

          const dx = sibCenterX - moverCenterX;
          const dy = sibCenterY - moverCenterY;

          const updatedSib = { ...sib };
          if (Math.abs(dx) >= Math.abs(dy)) {
            updatedSib.position = { ...sib.position, x: moverRight + PUSH_GAP };
          } else {
            updatedSib.position = { ...sib.position, y: moverBottom + PUSH_GAP };
          }

          nodeMap.set(sibId, updatedSib);
          nextMovers.push(sibId);
          anyMoved = true;
        }
      }

      if (!anyMoved) break;
      movers = nextMovers;
    }

    return nodes.map(n => nodeMap.get(n.id) ?? n);
  }

  // Panel height formulas: empty-state px | count * row-px + chrome-px
  private readonly EXPANSION_HEIGHT: Record<string, (req: Record<string, number>) => number> = {
    routeTable:          r => r['routeCount'] === 0 ? 48 : r['routeCount'] * 52 + 28,
    virtualNetwork:      r => r['subnetCount'] === 0 ? 40 : r['subnetCount'] * 40 + 24,
    nsg:                 r => r['ruleCount'] === 0 ? 40 : r['ruleCount'] * 52 + 24,
    storageAccount:      r => r['itemCount'] === 0 ? 32 : r['itemCount'] * 24 + 64,
    vm:                  _r => 28 + 3 * 18 + 20,
    aks:                 r => r['nodePoolCount'] === 0 ? 48 : r['nodePoolCount'] * 52 + 48,
    uai:                 r => r['assignmentCount'] === 0 ? 48 : r['assignmentCount'] * 64 + 24,
    hostingEnvironment:  r => r['statCount'] === 0 ? 40 : r['statCount'] * 26 + 20,
    serverFarm:          r => r['statCount'] === 0 ? 40 : r['statCount'] * 26 + 20,
    publicIp:            r => r['detailCount'] === 0 ? 40 : r['detailCount'] * 24 + 20,
    schedule:            r => r['detailCount'] === 0 ? 40 : r['detailCount'] * 24 + 20,
    disk:                r => r['detailCount'] === 0 ? 40 : r['detailCount'] * 24 + 20,
    azureFirewall:       r => r['detailCount'] === 0 ? 40 : r['detailCount'] * 24 + 20,
    applicationGateway:  r => r['detailCount'] === 0 ? 40 : r['detailCount'] * 24 + 20,
    connection:          r => r['detailCount'] === 0 ? 40 : r['detailCount'] * 24 + 20,
    dnsZone:             r => r['recordCount'] === 0 ? 40 : r['recordCount'] * 44 + 16,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onPanelExpansion(kind: string, req: any): void {
    const heightFn = this.EXPANSION_HEIGHT[kind];
    if (!heightFn) return;
    this.applyNodePanelExpansion(req.nodeId, req.expanded, heightFn(req), this.collapsedHeights);
  }

  onRouteTableExpansionChanged(req: RouteTableExpansionRequest): void { this.onPanelExpansion('routeTable', req); }
  onVirtualNetworkExpansionChanged(req: VirtualNetworkExpansionRequest): void { this.onPanelExpansion('virtualNetwork', req); }
  onNsgExpansionChanged(req: NsgExpansionRequest): void { this.onPanelExpansion('nsg', req); }
  onStorageAccountExpansionChanged(req: StorageAccountExpansionRequest): void { this.onPanelExpansion('storageAccount', req); }
  onVmExpansionChanged(req: VmExpansionRequest): void { this.onPanelExpansion('vm', req); }
  onAksExpansionChanged(req: AksExpansionRequest): void { this.onPanelExpansion('aks', req); }
  onUaiExpansionChanged(req: UaiExpansionRequest): void { this.onPanelExpansion('uai', req); }
  onHostingEnvironmentExpansionChanged(req: HostingEnvironmentExpansionRequest): void { this.onPanelExpansion('hostingEnvironment', req); }
  onServerFarmExpansionChanged(req: ServerFarmExpansionRequest): void { this.onPanelExpansion('serverFarm', req); }
  onPublicIpExpansionChanged(req: PublicIpExpansionRequest): void { this.onPanelExpansion('publicIp', req); }
  onScheduleExpansionChanged(req: ScheduleExpansionRequest): void { this.onPanelExpansion('schedule', req); }
  onDiskExpansionChanged(req: DiskExpansionRequest): void { this.onPanelExpansion('disk', req); }
  onAzureFirewallExpansionChanged(req: AzureFirewallExpansionRequest): void { this.onPanelExpansion('azureFirewall', req); }
  onApplicationGatewayExpansionChanged(req: ApplicationGatewayExpansionRequest): void { this.onPanelExpansion('applicationGateway', req); }
  onConnectionExpansionChanged(req: ConnectionExpansionRequest): void { this.onPanelExpansion('connection', req); }
  onDnsZoneExpansionChanged(req: DnsZoneExpansionRequest): void { this.onPanelExpansion('dnsZone', req); }

  private applyNodePanelExpansion(
    nodeId: string,
    expanded: boolean,
    panelHeight: number,
    collapsedHeights: Map<string, number>,
  ): void {
    const nextNodes = this.nodeExpansion.apply(this.store.nodes(), collapsedHeights, {
      nodeId,
      expanded,
      panelHeight,
    });
    if (!nextNodes) return;
    this.store.pushUndo();
    this.store.setNodes(nextNodes);
  }

  // ── Container rename ──────────────────────────────────────────────────────
  startRename(type: 'rg' | 'sub' | 'vm' | 'rt', id: string, currentName: string): void {
    this.renamingContainer = { type, id };
    this.renamingValue = currentName;
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
    await this.actions.toggleFinOpsDrawer();
  }

  async refreshFinOps(): Promise<void> {
    await this.actions.applyFinOpsFilters();
  }

  onFinOpsPeriodChange(period: 'mtd' | 'last30'): void {
    this.actions.setFinOpsPeriodPreset(period);
  }

  onFinOpsSubscriptionChange(subscriptionIds: string[]): void {
    this.actions.setSelectedSubscriptionIds(subscriptionIds);
  }

  onFinOpsResourceGroupChange(resourceGroups: string[]): void {
    this.actions.setSelectedResourceGroups(resourceGroups);
  }

  onFinOpsResourceTypeChange(resourceTypes: string[]): void {
    this.actions.setSelectedResourceTypes(resourceTypes);
  }

  get finOpsCostedNodeCount(): number { return this.actions.finOpsCostedNodeCount; }
  get finOpsTopNodes(): { id: string; label: string; cost: number }[] { return this.actions.finOpsTopNodes; }
  get finOpsTopNodesView(): { id: string; label: string; costText: string }[] {
    return this.finOpsTopNodes.map(n => ({ id: n.id, label: n.label, costText: this.formatCurrency(n.cost) }));
  }
  get finOpsState(): 'idle' | 'loading' | 'success' | 'partial' | 'error' { return this.actions.finOpsState(); }
  get finOpsStale(): boolean { return this.actions.finOpsStale(); }
  get finOpsDrawerOpen(): boolean { return this.actions.finOpsDrawerOpen(); }
  get finOpsPayload() { return this.actions.finOpsPayload(); }
  get finOpsPeriodPreset(): 'mtd' | 'last30' { return this.actions.finOpsPeriodPreset; }
  get finOpsBaseCurrency(): string { return this.actions.finOpsBaseCurrency; }
  get finOpsSubscriptionOptions(): { id: string; label: string }[] { return this.actions.finOpsSubscriptionOptions; }
  get finOpsResourceGroupOptions(): string[] { return this.actions.finOpsResourceGroupOptions; }
  get finOpsResourceTypeOptions(): string[] { return this.actions.finOpsResourceTypeOptions; }
  get finOpsSelectedSubscriptionIds(): string[] { return this.actions.selectedSubscriptionIds; }
  get finOpsSelectedResourceGroups(): string[] { return this.actions.selectedResourceGroups; }
  get finOpsSelectedResourceTypes(): string[] { return this.actions.selectedResourceTypes; }
  get finOpsByResourceGroup() { return this.actions.finOpsPayload()?.byResourceGroup ?? []; }
  get finOpsByResourceType() { return this.actions.finOpsPayload()?.byResourceType ?? []; }
  get finOpsLoadedSubscriptions(): number { return this.actions.finOpsPayload()?.loadedSubscriptionCount ?? 0; }
  get finOpsFailedSubscriptions(): number { return this.actions.finOpsPayload()?.failedSubscriptionCount ?? 0; }

  formatCurrency(value: number): string {
    return this.actions.formatCurrency(value, this.finOpsBaseCurrency);
  }

  get finOpsLoading(): boolean { return this.actions.finOpsState() === 'loading'; }
  get finOpsError(): string | null { return this.actions.finOpsError(); }

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
      const layoutNodes = currentNodes.map(node => {
        const h = this.collapsedHeights.get(node.id);
        return h !== undefined ? { ...node, size: { ...node.size, height: h } } : node;
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
    this.activeFontFamily = ann.fontFamily ?? 'Arial, sans-serif';
    this.activeFontSize = ann.fontSize ?? 14;
    this.activeStrokeWidth = ann.strokeWidth;
    this.activeStrokeStyle = ann.strokeStyle ?? 'solid';
    this.activeSloppiness = ann.sloppiness ?? 0;
    this.activeEdgeRouting = ann.edgeRouting ?? 'straight';
    this.activeEdgeMode = ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
    this.activeFill = ann.fill ?? 'none';
    this.activeFillOpacity = ann.fillOpacity ?? 0.2;
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
      activeFontFamily: this.activeFontFamily,
      activeFontSize: this.activeFontSize,
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
