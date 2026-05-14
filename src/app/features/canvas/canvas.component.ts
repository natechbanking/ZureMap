import { Component, inject, effect, ViewChild, ElementRef, computed, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
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
  K8sNamespaceBound,
  K8sScopeBound,
  K8sClusterBound,
  DrawnContainerBound,
  ResourceEditorDraft,
  SizeOffset,
  TagHighlightInfo,
  TagHighlightResizeDragState,
  ToolbarDragState,
  SubscriptionDragState,
  VmDragState,
  NodeDragState,
  RgDragState,
  K8sNamespaceDragState,
  K8sScopeDragState,
  K8sClusterDragState,
  EdgeWaypointDragState,
  AnnWaypointDragState,
  AnnEndpointDragState,
  EdgeLinkDragState,
  TagRule,
  NodeContainerAction,
} from './canvas.types';
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
  defaultNodePorts,
  portPosition,
  annotationPortPosition,
  CONNECTABLE_ANNOTATION_TYPES,
} from './canvas-geometry.util';
import { DrawingRuntimeState, DrawingStyleState, onDrawEnd, onDrawMove, onDrawStart, resetDrawingRuntime } from './canvas-drawing.util';
import { normalizePastedImage, pasteTargetPosition as pasteTargetPositionUtil } from './canvas-image-paste.util';
import { CanvasFacade } from './canvas-facade.service';
import { CanvasClipboardController } from './controllers/canvas-clipboard.controller';
import { CanvasAnnotationController } from './controllers/canvas-annotation.controller';
import { CanvasViewportController } from './controllers/canvas-viewport.controller';
import { CanvasSelectionController } from './controllers/canvas-selection.controller';
import { CanvasControllerContextService } from './controllers/canvas-controller-context.service';
import { CanvasEdgeController } from './controllers/canvas-edge.controller';

const ZERO_OFFSET: SizeOffset = { top: 0, right: 0, bottom: 0, left: 0 };
const AZURE_RESOURCE_DND_TYPE = 'application/x-zuremap-azure-resource';
interface ShapeBindCandidate {
  annotation: Annotation;
  bounds: { x: number; y: number; width: number; height: number };
}

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeyDown($event)',
    '(document:paste)': 'onPaste($event)',
    '(document:mousemove)': 'onDocMouseMove($event)',
    '(document:mouseup)': 'onDocMouseUp($event)',
  },
  providers: [
    CanvasControllerContextService,
    CanvasViewportController,
    CanvasSelectionController,
    CanvasClipboardController,
    CanvasAnnotationController,
    CanvasEdgeController,
    CanvasFacade,
  ],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasHost', { read: ElementRef }) canvasHostRef!: ElementRef;
  @ViewChild('exportRoot', { read: ElementRef }) exportRootRef!: ElementRef;

  store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  protected iconRegistryService = inject(IconRegistryService);
  private actions = inject(CanvasActionsService);
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
  readonly facade = inject(CanvasFacade);
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

  visibleNodes: DiagramNode[] = [];
  visibleEdges = this.store.edges();
  subscriptionBounds: SubscriptionBound[] = [];
  rgBounds: RgBound[] = [];
  vmBounds: VmBound[] = [];
  routeTableBounds: RouteTableBound[] = [];
  k8sNamespaceBounds: K8sNamespaceBound[] = [];
  k8sScopeBounds: K8sScopeBound[] = [];
  k8sClusterBounds: K8sClusterBound[] = [];
  drawnContainerBounds: DrawnContainerBound[] = [];
  nodeContainerActions = new Map<string, NodeContainerAction>();

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
  private collapsedK8sNamespaces = new Set<string>();
  private collapsedK8sScopes = new Set<string>();
  private collapsedK8sClusters = new Set<string>();
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
    this.facade.viewport.setInitialViewportSize(this.canvasHostRef?.nativeElement as HTMLElement | undefined);
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
  get minimapOpen(): boolean { return this.facade.viewport.minimapOpen(); }
  set minimapOpen(value: boolean) { this.facade.viewport.minimapOpen.set(value); }
  get minimapScrollLeft(): number { return this.facade.viewport.minimapScrollLeft(); }
  set minimapScrollLeft(value: number) { this.facade.viewport.minimapScrollLeft.set(value); }
  get minimapScrollTop(): number { return this.facade.viewport.minimapScrollTop(); }
  set minimapScrollTop(value: number) { this.facade.viewport.minimapScrollTop.set(value); }
  get minimapViewportWidth(): number { return this.facade.viewport.minimapViewportWidth(); }
  set minimapViewportWidth(value: number) { this.facade.viewport.minimapViewportWidth.set(value); }
  get minimapViewportHeight(): number { return this.facade.viewport.minimapViewportHeight(); }
  set minimapViewportHeight(value: number) { this.facade.viewport.minimapViewportHeight.set(value); }

  onCanvasScroll(): void {
    this.facade.viewport.onCanvasScroll(this.canvasHostRef?.nativeElement as HTMLElement | undefined);
  }

  onMinimapPan(e: { scrollLeft: number; scrollTop: number }): void {
    this.facade.viewport.onMinimapPan(e, this.canvasHostRef?.nativeElement as HTMLElement | undefined);
  }

  // ── Resource placement state ───────────────────────────────────────────────
  activeResourceType = '';
  showCreateResourceModal = false;
  resourcePlacementPosition: { x: number; y: number } | null = null;

  get selectedAnnotationId(): string | null { return this.facade.selection.selectedAnnotationId(); }
  set selectedAnnotationId(value: string | null) { this.facade.selection.selectedAnnotationId.set(value); }
  get selectedAnnotationIds(): string[] { return this.facade.selection.selectedAnnotationIds(); }
  set selectedAnnotationIds(value: string[]) { this.facade.selection.selectedAnnotationIds.set(value); }
  editingAnnotation: Annotation | null = null;
  editingTextValue = '';

  // In-progress drawing previews
  previewPath = '';
  previewArrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewRect: { x: number; y: number; w: number; h: number } | null = null;
  previewDiamond: { x: number; y: number; w: number; h: number } | null = null;
  previewEllipse: { cx: number; cy: number; rx: number; ry: number } | null = null;
  drawBindPreviewPorts: { nodeId: string; portId: string; x: number; y: number }[] = [];
  drawBindPreviewActivePortId: string | null = null;
  private drawStartBindPort: { nodeId: string; portId: string; x: number; y: number } | null = null;

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
  private annEndpointDragState: AnnEndpointDragState | null = null;

  // RG mouse drag (smooth, incremental)
  rgDragState: RgDragState | null = null;
  get isRgDragging(): boolean { return this.rgDragState !== null; }
  subscriptionDragState: SubscriptionDragState | null = null;
  get isSubscriptionDragging(): boolean { return this.subscriptionDragState !== null; }
  vmDragState: VmDragState | null = null;
  get isVmDragging(): boolean { return this.vmDragState !== null; }
  k8sNamespaceDragState: K8sNamespaceDragState | null = null;
  k8sScopeDragState: K8sScopeDragState | null = null;
  k8sClusterDragState: K8sClusterDragState | null = null;

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
  renamingContainer: { type: 'rg' | 'sub' | 'vm' | 'rt' | 'k8sns' | 'k8sscope' | 'k8scluster' | 'drawn'; id: string } | null = null;
  renamingValue = '';

  // Floating toolbar drag
  toolbarPos = { x: 12, y: 12 };
  toolbarDragState: ToolbarDragState | null = null;

  // Node HTML5 drag
  private dragOffset = { x: 0, y: 0 };
  private collapsedHeights = new Map<string, number>();
  get selectedEdgeId(): string | null { return this.facade.selection.selectedEdgeId(); }
  set selectedEdgeId(value: string | null) { this.facade.selection.selectedEdgeId.set(value); }
  edgeWaypointDragState: EdgeWaypointDragState | null = null;
  annWaypointDragState: AnnWaypointDragState | null = null;
  edgeLinkDragState: EdgeLinkDragState | null = null;
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
  onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const copied = this.copySelectedCanvasObject();
      if (copied) e.preventDefault();
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

  async onPaste(event: ClipboardEvent): Promise<void> {
    if (this.activeTool !== 'pointer') return;
    if ((event.target as HTMLElement | null)?.matches('input,textarea,[contenteditable=true]')) return;
    const items = event.clipboardData?.items;
    if (!items?.length) {
      if (this.pasteCanvasClipboard()) event.preventDefault();
      return;
    }

    const imageItem = Array.from(items).find(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (!imageItem) {
      if (this.pasteCanvasClipboard()) event.preventDefault();
      return;
    }

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

    if (this.edgeLinkDragState) {
      const pt = this.canvasPointFromClient(e.clientX, e.clientY);
      this.edgeLinkDragState = { ...this.edgeLinkDragState, currentX: pt.x, currentY: pt.y };
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

    if (this.annEndpointDragState) {
      const pt = this.svgPoint(e);
      const { annId, endpoint } = this.annEndpointDragState;
      this.annEndpointDragState = { annId, endpoint, lastX: pt.x, lastY: pt.y };
      if (endpoint === 'start') {
        this.store.updateAnnotation(annId, { x: pt.x, y: pt.y, sourceBinding: undefined });
      } else {
        this.store.updateAnnotation(annId, { x2: pt.x, y2: pt.y, targetBinding: undefined });
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

    const draggedAnnBefore = this.annDragId
      ? this.store.annotations().find(a => a.id === this.annDragId)
      : null;
    const draggedNodeIdsBefore = this.nodeDragState?.ids ?? [];
    const result = this.dragSvc.onDocumentMouseMove({
      event: e,
      zoomLevel: this.zoomLevel,
      toolbarPos: this.toolbarPos,
      toolbarDragState: this.toolbarDragState,
      nodeDragState: this.nodeDragState,
      subscriptionDragState: this.subscriptionDragState,
      vmDragState: this.vmDragState,
      rgDragState: this.rgDragState,
      k8sNamespaceDragState: this.k8sNamespaceDragState,
      k8sScopeDragState: this.k8sScopeDragState,
      k8sClusterDragState: this.k8sClusterDragState,
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
      moveK8sNamespaceGroup: (nsKey, delta) => this.store.moveK8sNamespaceGroup(nsKey, delta),
      moveK8sScopeGroup: (scopeKey, delta) => this.store.moveK8sScopeGroup(scopeKey, delta),
      moveK8sClusterGroup: delta => this.store.moveK8sClusterGroup(delta),
      updateAnnotation: (id, changes) => this.store.updateAnnotation(id, changes),
    });
    if (!result.handled) return;
    this.toolbarPos = result.toolbarPos;
    this.toolbarDragState = result.toolbarDragState;
    this.nodeDragState = result.nodeDragState;
    this.subscriptionDragState = result.subscriptionDragState;
    this.vmDragState = result.vmDragState;
    this.rgDragState = result.rgDragState;
    this.k8sNamespaceDragState = result.k8sNamespaceDragState;
    this.k8sScopeDragState = result.k8sScopeDragState;
    this.k8sClusterDragState = result.k8sClusterDragState;
    if (draggedNodeIdsBefore.length > 0 && result.nodeDragState?.hasMoved) {
      this.expandBoundShapesForNodes(draggedNodeIdsBefore);
    }
    if (this.annDragId && draggedAnnBefore) {
      const draggedAnnAfter = this.store.annotations().find(a => a.id === this.annDragId);
      if (draggedAnnAfter) {
        const dx = draggedAnnAfter.x - draggedAnnBefore.x;
        const dy = draggedAnnAfter.y - draggedAnnBefore.y;
        this.moveNodesBoundToShape(this.annDragId, dx, dy);
      }
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    this.setZoom(this.zoomLevel + delta, { x: event.clientX, y: event.clientY });
  }

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
            let minX: number, minY: number, maxX: number, maxY: number;
            if ((a.type === 'arrow' || a.type === 'line') && (a.sourceBinding || a.targetBinding)) {
              const start = this.resolveAnnotationEndpointPosition(a, 'start');
              const end = this.resolveAnnotationEndpointPosition(a, 'end');
              minX = Math.min(start.x, end.x);
              minY = Math.min(start.y, end.y);
              maxX = Math.max(start.x, end.x);
              maxY = Math.max(start.y, end.y);
            } else {
              const b = annotationBoundsUtil(a);
              minX = b.minX; minY = b.minY; maxX = b.maxX; maxY = b.maxY;
            }
            return maxX > x && minX < x + w && maxY > y && minY < y + h;
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

    if (this.edgeLinkDragState) {
      const drag = this.edgeLinkDragState;
      this.edgeLinkDragState = null;
      const pt = this.canvasPointFromClient(e.clientX, e.clientY);
      const hit = this.portAtCanvasPoint(pt.x, pt.y);
      const isSelf = hit && (
        (hit.nodeId       && hit.nodeId       === drag.sourceNodeId) ||
        (hit.annotationId && hit.annotationId === drag.sourceAnnotationId)
      );
      if (hit && !isSelf) {
        this.store.pushUndo();
        const dashArray =
          this.activeStrokeStyle === 'dashed' ? '8 4' :
          this.activeStrokeStyle === 'dotted' ? '2 5' :
          undefined;
        const markerEnd: 'arrow' | 'none' = 'arrow';
        this.store.setEdges([...this.store.edges(), {
          id: this.nextEdgeId(),
          sourceId: drag.sourceNodeId ?? '',
          sourcePort: drag.sourcePortId,
          sourceAnnotationId: drag.sourceAnnotationId,
          targetId: hit.nodeId ?? '',
          targetPort: hit.portId,
          targetAnnotationId: hit.annotationId,
          edgeType: 'dependency',
          animated: false,
          style: {
            strokeColor: this.activeColor,
            strokeWidth: this.activeStrokeWidth,
            dashArray,
            markerEnd,
          },
        }]);
      }
      return;
    }

    if (this.annEndpointDragState) {
      const drag = this.annEndpointDragState;
      this.annEndpointDragState = null;
      const pt = this.canvasPointFromClient(e.clientX, e.clientY);
      const hit = this.portAtCanvasPoint(pt.x, pt.y);
      if (hit) {
        const binding = { nodeId: hit.nodeId, annotationId: hit.annotationId, portId: hit.portId };
        if (drag.endpoint === 'start') {
          this.store.updateAnnotation(drag.annId, { sourceBinding: binding });
        } else {
          this.store.updateAnnotation(drag.annId, { targetBinding: binding });
        }
      }
      return;
    }

    this.toolbarDragState = null;
    this.subscriptionDragState = null;
    this.vmDragState = null;
    this.rgDragState = null;
    this.k8sNamespaceDragState = null;
    this.k8sScopeDragState = null;
    this.k8sClusterDragState = null;
    this.nodeDragState = null;
    this.annDragId = null;
    this.edgeWaypointDragState = null;
    this.annWaypointDragState = null;
    this.imageResizeDrag = null;
    this.annShapeResizeDrag = null;
    this.annRotateDrag = null;
    this.annEndpointDragState = null;
  }

  // ── Tool management ────────────────────────────────────────────────────────
  setTool(tool: DrawingTool): void {
    this.activeTool = tool;
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.selectedEdgeId = null;
    this.applyDrawingRuntime(resetDrawingRuntime(this.currentDrawingRuntime()));
    this.clearDrawBindPreviewPorts();
  }

  get discoveredResourceTypes(): string[] {
    return [...new Set(this.store.nodes().map(n => n.resourceType).filter(Boolean))];
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
    const isK8sWorkload = this.activeResourceType.startsWith('kubernetes/');
    const node: DiagramNode = {
      id,
      label: data.name,
      resourceType: this.activeResourceType,
      iconUrl,
      group: isK8sWorkload ? 'k8sNamespace' : 'standalone',
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
          .map((item, i) => ({
            id: `ii-${i}`,
            text: item.text,
            x: 4,
            y: 20 + i * 16,
            baseColor: '#1d4ed8',
            color: '#1d4ed8',
            baseBackgroundColor: '#eff6ff',
            backgroundColor: '#eff6ff',
          })),
      },
    };
    this.store.pushUndo();
    // Apply any existing internal-item style rules to the newly created node.
    this.store.setNodes(this.applyInternalItemStyleRulesToNodes([...this.store.nodes(), node]));
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
    let startPt = pt;
    this.drawStartBindPort = null;
    if (this.activeTool === 'arrow') {
      const startSnap = this.nearestNodePortAtPoint(pt, 18);
      if (startSnap) {
        this.drawStartBindPort = startSnap;
        startPt = { x: startSnap.x, y: startSnap.y };
      }
    }
    const result = onDrawStart(this.currentDrawingRuntime(), this.currentDrawingStyle(), startPt);
    this.applyDrawingRuntime(result.next);
    this.updateDrawBindPreviewPorts(startPt);
    if (result.createdAnnotation) {
      this.store.pushUndo();
      this.store.addAnnotation(result.createdAnnotation);
      if (result.shouldStartEdit) this.startEditAnnotation(result.createdAnnotation);
    }
  }

  onDrawMouseMove(e: MouseEvent): void {
    const pt = this.svgPoint(e);
    let movePt = pt;
    if (this.activeTool === 'arrow') {
      const snap = this.nearestNodePortAtPoint(pt, 18);
      if (snap) movePt = { x: snap.x, y: snap.y };
    }
    this.applyDrawingRuntime(onDrawMove(this.currentDrawingRuntime(), this.currentDrawingStyle(), movePt));
    this.updateDrawBindPreviewPorts(pt);
  }

  onDrawMouseUp(e: MouseEvent): void {
    const pt = this.svgPoint(e);
    const result = onDrawEnd(this.currentDrawingRuntime(), this.currentDrawingStyle(), pt);
    this.applyDrawingRuntime(result.next);
    this.clearDrawBindPreviewPorts();
    if (result.createdAnnotation) {
      if (result.createdAnnotation.type === 'arrow') {
        const ann = result.createdAnnotation;
        const endSnap = this.nearestNodePortAtPoint(pt, 18);
        if (this.drawStartBindPort) {
          ann.x = this.drawStartBindPort.x;
          ann.y = this.drawStartBindPort.y;
          ann.sourceBinding = {
            nodeId: this.drawStartBindPort.nodeId,
            portId: this.drawStartBindPort.portId,
          };
        }
        if (endSnap) {
          ann.x2 = endSnap.x;
          ann.y2 = endSnap.y;
          ann.targetBinding = {
            nodeId: endSnap.nodeId,
            portId: endSnap.portId,
          };
        }
      }
      this.store.pushUndo();
      this.store.addAnnotation(result.createdAnnotation);
    }
    this.drawStartBindPort = null;
  }

  // ── Annotation interaction ─────────────────────────────────────────────────
  onAnnotationMouseDown(e: MouseEvent, ann: Annotation): void {
    const dragStart = this.facade.annotation.onAnnotationMouseDown(e, ann, {
      activeTool: this.activeTool,
      selectedAnnotationId: this.selectedAnnotationId,
      selectedAnnotationIds: this.selectedAnnotationIds,
      canvasPointFromClient: (x, y) => this.canvasPointFromClient(x, y),
      nodeAtCanvasPoint: (x, y) => this.nodeAtCanvasPoint(x, y),
      onNodeMouseDown: (event, node) => this.onNodeMouseDown(event, node),
      closeAnnotationAndResourceMenus: () => {
        this.ctxMenuSvc.annotationContextMenu = null;
        this.ctxMenuSvc.contextMenu = null;
      },
      clearEdgeSelection: () => {
        this.selectedEdgeId = null;
      },
      annotationById: id => this.annotationById(id),
      syncToolbarFromAnnotation: annotation => this.syncToolbarFromAnnotation(annotation),
      svgPoint: event => this.svgPoint(event),
      setSelection: (id, ids) => {
        this.selectedAnnotationId = id;
        this.selectedAnnotationIds = ids;
      },
    });
    if (!dragStart) return;
    this.annDragId = dragStart.annDragId;
    this.annDragMouse = dragStart.annDragMouse;
    this.annDragOrigin = dragStart.annDragOrigin;
  }

  onImageResizeMouseDown(e: MouseEvent, ann: Annotation): void {
    const drag = this.facade.annotation.onImageResizeMouseDown(e, ann, this.activeTool);
    if (!drag) return;
    this.imageResizeDrag = drag;
  }

  onAnnotationShapeResizeMouseDown(e: MouseEvent, ann: Annotation, handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'): void {
    const drag = this.facade.annotation.onAnnotationShapeResizeMouseDown(
      e,
      ann,
      handle,
      this.activeTool,
      annotationTextWidthUtil(ann),
      annotationTextHeightUtil(ann),
    );
    if (!drag) return;
    this.annShapeResizeDrag = drag;
  }

  onAnnotationRotateMouseDown(e: MouseEvent, ann: Annotation): void {
    const drag = this.facade.annotation.onAnnotationRotateMouseDown(
      e,
      ann,
      this.activeTool,
      annotationTextWidthUtil(ann),
      annotationTextHeightUtil(ann),
    );
    if (!drag) return;
    this.annRotateDrag = drag;
  }

  startEditAnnotation(ann: Annotation): void {
    const result = this.facade.annotation.startEditAnnotation(ann);
    this.editingAnnotation = result.editingAnnotation;
    this.editingTextValue = result.editingTextValue;
  }

  finishEdit(nextText?: string): void {
    const result = this.facade.annotation.finishEdit(
      this.editingAnnotation,
      this.editingTextValue,
      annotationId => this.clearShapeBinding(annotationId),
      nextText,
    );
    if (!result) return;
    this.editingAnnotation = result.editingAnnotation;
    this.editingTextValue = result.editingTextValue;
  }

  cancelEdit(): void {
    const result = this.facade.annotation.cancelEdit(
      this.editingAnnotation,
      annotationId => this.clearShapeBinding(annotationId),
    );
    this.editingAnnotation = result.editingAnnotation;
    this.editingTextValue = result.editingTextValue;
  }

  onEditKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
    if (e.key === 'Enter' && !e.shiftKey && this.editingAnnotation?.type === 'text') {
      e.preventDefault(); this.finishEdit();
    }
  }

  private annotationSelectionContext(): {
    selectedAnnotationId: string | null;
    selectedAnnotationIds: string[];
    activeTool: string;
    clearShapeBinding: (annotationId: string) => void;
    syncToolbarFromAnnotation: (annotation: Annotation) => void;
    setSelectedAnnotation: (id: string | null, ids: string[]) => void;
  } {
    return {
      selectedAnnotationId: this.selectedAnnotationId,
      selectedAnnotationIds: this.selectedAnnotationIds,
      activeTool: this.activeTool,
      clearShapeBinding: annotationId => this.clearShapeBinding(annotationId),
      syncToolbarFromAnnotation: annotation => this.syncToolbarFromAnnotation(annotation),
      setSelectedAnnotation: (id, ids) => {
        this.selectedAnnotationId = id;
        this.selectedAnnotationIds = ids;
      },
    };
  }

  private nextEdgeId(): string {
    return `copy-edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  deleteSelectedAnnotation(): void {
    this.facade.annotation.deleteSelectedAnnotation(this.annotationSelectionContext());
  }

  deleteSelectedEdge(): void {
    if (!this.selectedEdgeId) return;
    this.store.pushUndo();
    const selectedEdgeId = this.selectedEdgeId;
    this.store.setEdges(this.store.edges().filter(edge => edge.id !== selectedEdgeId));
    this.selectedEdgeId = null;
  }

  duplicateSelectedAnnotation(): void {
    this.facade.annotation.duplicateSelectedAnnotation(this.annotationSelectionContext());
  }

  bringSelectedAnnotationToFront(): void {
    this.facade.annotation.bringSelectedAnnotationToFront(this.annotationSelectionContext());
  }

  sendSelectedAnnotationToBack(): void {
    this.facade.annotation.sendSelectedAnnotationToBack(this.annotationSelectionContext());
  }

  clearAllAnnotations(): void {
    const cleared = this.facade.annotation.clearAllAnnotations();
    if (!cleared) return;
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.editingAnnotation = null;
    this.editingTextValue = '';
  }

  // ── Annotation helpers ─────────────────────────────────────────────────────
  annotationById(id: string): Annotation | undefined {
    return this.store.annotations().find(a => a.id === id);
  }

  /**
   * Resolves the actual display position of an arrow/line annotation endpoint,
   * accounting for sourceBinding/targetBinding when present. Falls back to the
   * raw x/y or x2/y2 coordinates when the binding cannot be resolved.
   */
  private resolveAnnotationEndpointPosition(ann: Annotation, endpoint: 'start' | 'end'): { x: number; y: number } {
    const binding = endpoint === 'start' ? ann.sourceBinding : ann.targetBinding;
    if (binding?.nodeId) {
      const node = this.visibleNodes.find(n => n.id === binding.nodeId);
      if (node) {
        const pos = portPosition(node, binding.portId);
        if (pos) return pos;
      }
    }
    if (binding?.annotationId) {
      const boundAnn = this.store.annotations().find(a => a.id === binding.annotationId);
      if (boundAnn) {
        const pos = annotationPortPosition(boundAnn, binding.portId);
        if (pos) return pos;
      }
    }
    return endpoint === 'start'
      ? { x: ann.x, y: ann.y }
      : { x: ann.x2 ?? ann.x, y: ann.y2 ?? ann.y };
  }

  annDeleteBtnX(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') {
      const sx = this.resolveAnnotationEndpointPosition(ann, 'start').x;
      const ex = this.resolveAnnotationEndpointPosition(ann, 'end').x;
      return Math.max(sx, ex) + 8;
    }
    return this.annotationSvc.deleteButtonX(ann);
  }

  annDeleteBtnY(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') {
      const sy = this.resolveAnnotationEndpointPosition(ann, 'start').y;
      const ey = this.resolveAnnotationEndpointPosition(ann, 'end').y;
      return Math.min(sy, ey) - 10;
    }
    return this.annotationSvc.deleteButtonY(ann);
  }

  get selectedAnnotationForDelete(): Annotation | null {
    return this.facade.annotation.selectedAnnotationForDelete(this.selectedAnnotationId, this.activeTool);
  }

  get canEditSelectedTextStyle(): boolean {
    return this.facade.annotation.canEditSelectedTextStyle(this.selectedAnnotationId);
  }

  get canEditSelectedFillStyle(): boolean {
    return this.facade.annotation.canEditSelectedFillStyle(this.selectedAnnotationId);
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
      if (ann.type === 'arrow' || ann.type === 'line') {
        const sx = this.resolveAnnotationEndpointPosition(ann, 'start').x;
        const ex = this.resolveAnnotationEndpointPosition(ann, 'end').x;
        maxX = Math.max(maxX, sx + 80, ex + 80);
      } else {
        maxX = Math.max(maxX, annotationMaxXUtil(ann) + 80);
      }
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
      if (ann.type === 'arrow' || ann.type === 'line') {
        const sy = this.resolveAnnotationEndpointPosition(ann, 'start').y;
        const ey = this.resolveAnnotationEndpointPosition(ann, 'end').y;
        maxY = Math.max(maxY, sy + 80, ey + 80);
      } else {
        maxY = Math.max(maxY, annotationMaxYUtil(ann) + 80);
      }
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

  toggleK8sNamespaceCollapsed(nsId: string): void {
    const result = this.collapseSvc.toggleK8sNamespace(
      this.collapsedK8sNamespaces,
      nsId,
      this.store.selectedNode(),
    );
    this.collapsedK8sNamespaces = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleK8sScopeCollapsed(scopeId: string): void {
    const result = this.collapseSvc.toggleK8sScope(
      this.collapsedK8sScopes,
      scopeId,
      this.store.selectedNode(),
    );
    this.collapsedK8sScopes = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleK8sClusterCollapsed(clusterId: string): void {
    const result = this.collapseSvc.toggleK8sCluster(
      this.collapsedK8sClusters,
      clusterId,
      this.store.selectedNode(),
    );
    this.collapsedK8sClusters = result.next;
    if (result.clearSelection) this.store.selectNode(null);
    this.refreshVisibility(this.store.nodes(), this.store.edges());
  }

  toggleDrawnContainerCollapsed(annotationId: string): void {
    const ann = this.store.annotations().find(a => a.id === annotationId);
    if (!ann?.container) return;
    this.store.pushUndo();
    this.store.updateAnnotation(annotationId, {
      container: {
        ...ann.container,
        collapsed: !ann.container.collapsed,
      },
    });
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
      collapsedK8sNamespaces: this.collapsedK8sNamespaces,
      collapsedK8sScopes: this.collapsedK8sScopes,
      collapsedK8sClusters: this.collapsedK8sClusters,
      customContainerNames: this.store.customContainerNames(),
      selectedEdgeId: this.selectedEdgeId,
    });
    this.drawnContainerBounds = this.computeDrawnContainerBounds(this.store.annotations());
    const collapsedDrawnIds = new Set(this.drawnContainerBounds.filter(b => b.collapsed).map(b => b.id));
    const filteredVisibleNodes = collapsedDrawnIds.size === 0
      ? visibility.visibleNodes
      : visibility.visibleNodes.filter(n => !collapsedDrawnIds.has(n.custom?.boundShapeAnnotationId ?? ''));
    const visibleIds = new Set(filteredVisibleNodes.map(n => n.id));
    this.visibleNodes = filteredVisibleNodes;
    this.visibleEdges = visibility.visibleEdges.filter(e => {
      const srcOk = e.sourceAnnotationId ? true : visibleIds.has(e.sourceId);
      const tgtOk = e.targetAnnotationId ? true : visibleIds.has(e.targetId);
      return srcOk && tgtOk;
    });
    this.rgBounds = visibility.rgBounds;
    this.subscriptionBounds = visibility.subscriptionBounds;
    this.vmBounds = visibility.vmBounds;
    this.routeTableBounds = visibility.routeTableBounds;
    this.k8sNamespaceBounds = visibility.k8sNamespaceBounds;
    this.k8sScopeBounds = visibility.k8sScopeBounds;
    this.k8sClusterBounds = visibility.k8sClusterBounds;
    this.recomputeNodeContainerActions();
    if (this.selectedEdgeId && !this.visibleEdges.some(e => e.id === this.selectedEdgeId)) {
      this.selectedEdgeId = null;
    }
    this.resolveSubscriptionContainerOverlaps(this.subscriptionBounds);
    this.resolveRgContainerOverlaps(this.rgBounds);
    this.recomputeTagHighlights(nodes);
  }

  private recomputeNodeContainerActions(): void {
    const allNodes = this.store.nodes();
    const allAnnotations = this.store.annotations();
    const byId = new Map(allNodes.map(n => [n.id, n]));
    const annById = new Map(allAnnotations.map(a => [a.id, a]));
    const shapeCandidates = this.collectShapeBindCandidates(allAnnotations);
    const parentMap = this.childToParentMap();
    const actions = new Map<string, NodeContainerAction>();
    for (const node of this.visibleNodes) {
      const boundShapeId = node.custom?.boundShapeAnnotationId;
      const boundShape = boundShapeId ? annById.get(boundShapeId) : undefined;
      if (boundShape) {
        actions.set(node.id, {
          kind: 'breakout',
          label: `Break out of ${this.shapeLabel(boundShape)}`,
          title: `Break out of ${this.shapeLabel(boundShape)}`,
          targetType: 'shape',
          targetId: boundShape.id,
        });
        continue;
      }
      const parentId = parentMap.get(node.id) ?? null;
      if (parentId) {
        actions.set(node.id, {
          kind: 'breakout',
          label: `Break out of ${this.parentLabelById().get(parentId) ?? 'container'}`,
          title: `Break out of ${this.parentLabelById().get(parentId) ?? 'container'}`,
          targetType: 'parent',
          targetId: parentId,
        });
        continue;
      }
      if (node.group === 'resourceGroup') {
        const rgLabel = node.metadata?.resourceGroup || node.groupId || 'resource group';
        actions.set(node.id, {
          kind: 'breakout',
          label: `Break out of ${rgLabel}`,
          title: `Break out of ${rgLabel}`,
          targetType: 'rg',
          targetId: node.groupId,
        });
        continue;
      }
      actions.set(node.id, this.bindActionForUnboundNode(node, byId, shapeCandidates));
    }
    this.nodeContainerActions = actions;
  }

  private bindActionForUnboundNode(
    node: DiagramNode,
    byId: Map<string, DiagramNode>,
    shapeCandidates: ShapeBindCandidate[],
  ): NodeContainerAction {
    const cx = node.position.x + node.size.width / 2;
    const cy = node.position.y + node.size.height / 2;
    const allCandidates: { area: number; action: NodeContainerAction }[] = [];
    const pushCandidate = (bounds: { x: number; y: number; width: number; height: number }, action: NodeContainerAction): void => {
      if (cx < bounds.x || cx > bounds.x + bounds.width || cy < bounds.y || cy > bounds.y + bounds.height) return;
      allCandidates.push({ area: bounds.width * bounds.height, action });
    };

    for (const b of this.vmBounds) {
      const parent = byId.get(b.id);
      if (!parent || parent.id === node.id || this.isDescendantNode(parent.id, node.id, byId)) continue;
      pushCandidate(b, {
        kind: 'bind',
        label: `Bind to ${parent.label}`,
        title: `Bind to ${parent.label}`,
        targetType: 'parent',
        targetId: parent.id,
      });
    }
    for (const b of this.routeTableBounds) {
      const parent = byId.get(b.id);
      if (!parent || parent.id === node.id || this.isDescendantNode(parent.id, node.id, byId)) continue;
      pushCandidate(b, {
        kind: 'bind',
        label: `Bind to ${parent.label}`,
        title: `Bind to ${parent.label}`,
        targetType: 'parent',
        targetId: parent.id,
      });
    }
    for (const b of this.rgBounds) {
      pushCandidate(b, {
        kind: 'bind',
        label: `Bind to ${b.name}`,
        title: `Bind to ${b.name}`,
        targetType: 'rg',
        targetId: b.id,
      });
    }
    for (const b of this.subscriptionBounds) {
      pushCandidate(b, {
        kind: 'bind-disabled',
        label: `Bind to ${b.name}`,
        title: 'Subscription container does not have bind support yet',
        targetType: 'unsupported',
        targetId: b.id,
      });
    }
    for (const b of this.k8sNamespaceBounds) {
      pushCandidate(b, {
        kind: 'bind-disabled',
        label: `Bind to ${b.name}`,
        title: 'Kubernetes namespace container does not have bind support yet',
        targetType: 'unsupported',
        targetId: b.id,
      });
    }
    for (const b of this.k8sScopeBounds) {
      pushCandidate(b, {
        kind: 'bind-disabled',
        label: `Bind to ${b.name}`,
        title: 'Kubernetes scope container does not have bind support yet',
        targetType: 'unsupported',
        targetId: b.id,
      });
    }
    for (const b of this.k8sClusterBounds) {
      pushCandidate(b, {
        kind: 'bind-disabled',
        label: `Bind to ${b.name}`,
        title: 'Kubernetes cluster container does not have bind support yet',
        targetType: 'unsupported',
        targetId: b.id,
      });
    }
    for (const shapeCandidate of shapeCandidates) {
      pushCandidate(shapeCandidate.bounds, {
        kind: 'bind',
        label: `Bind to ${this.shapeLabel(shapeCandidate.annotation)}`,
        title: `Bind to ${this.shapeLabel(shapeCandidate.annotation)}`,
        targetType: 'shape',
        targetId: shapeCandidate.annotation.id,
      });
    }

    allCandidates.sort((a, b) => a.area - b.area);
    const best = allCandidates[0]?.action;
    if (best) return best;

    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent && parent.id !== node.id && !this.isDescendantNode(parent.id, node.id, byId)) {
      return {
        kind: 'bind',
        label: `Bind to ${parent.label}`,
        title: `Bind to ${parent.label}`,
        targetType: 'parent',
        targetId: parent.id,
      };
    }

    const nodeSub = node.metadata?.subscriptionId || '';
    const nodeRg = node.metadata?.resourceGroup || '';
    if (nodeRg) {
      const rgBound = this.rgBounds.find(b => b.name === nodeRg && b.subscriptionId === nodeSub);
      const rgTargetId = rgBound?.id ?? `${nodeSub}::${nodeRg}`;
      return {
        kind: 'bind',
        label: `Bind to ${nodeRg}`,
        title: `Bind to ${nodeRg}`,
        targetType: 'rg',
        targetId: rgTargetId,
      };
    }

    return { kind: 'none', label: '', title: '' };
  }

  private collectShapeBindCandidates(annotations: Annotation[]): ShapeBindCandidate[] {
    const candidates: ShapeBindCandidate[] = [];
    for (const ann of annotations) {
      if (ann.type !== 'rect' && ann.type !== 'ellipse' && ann.type !== 'diamond') continue;
      const width = ann.width ?? 0;
      const height = ann.height ?? 0;
      if (width <= 0 || height <= 0) continue;
      candidates.push({
        annotation: ann,
        bounds: { x: ann.x, y: ann.y, width, height },
      });
    }
    return candidates;
  }

  private computeDrawnContainerBounds(annotations: Annotation[]): DrawnContainerBound[] {
    const HEADER_H = 32;
    const COLLAPSED_EXTRA = 8;
    const MIN_W = 180;
    return annotations
      .filter(a => a.type === 'rect' && !!a.container && (a.width ?? 0) > 0 && (a.height ?? 0) > 0)
      .map(a => {
        const width = Math.max(MIN_W, a.width ?? 0);
        const collapsed = !!a.container?.collapsed;
        return {
          id: a.id,
          kind: a.container!.kind,
          name: a.container!.name || (a.container!.kind === 'rg' ? 'Resource Group' : 'Subscription'),
          collapsed,
          x: a.x,
          y: a.y,
          width,
          height: collapsed ? HEADER_H + COLLAPSED_EXTRA : (a.height ?? HEADER_H + COLLAPSED_EXTRA),
        };
      });
  }

  private shapeLabel(ann: Annotation): string {
    if (ann.container) return ann.container.name || (ann.container.kind === 'rg' ? 'Resource Group' : 'Subscription');
    if (ann.type === 'rect') return 'rectangle';
    if (ann.type === 'ellipse') return 'ellipse';
    if (ann.type === 'diamond') return 'diamond';
    return 'shape';
  }

  private clearShapeBinding(shapeId: string): void {
    this.store.setNodes(this.store.nodes().map(n => {
      if (n.custom?.boundShapeAnnotationId !== shapeId) return n;
      return { ...n, custom: { ...(n.custom ?? {}), boundShapeAnnotationId: undefined } };
    }));
  }

  private moveNodesBoundToShape(shapeId: string, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.store.setNodes(this.store.nodes().map(n => {
      if (n.custom?.boundShapeAnnotationId !== shapeId) return n;
      return {
        ...n,
        position: {
          x: Math.max(0, n.position.x + dx),
          y: Math.max(0, n.position.y + dy),
        },
      };
    }));
  }

  private expandBoundShapesForNodes(nodeIds: string[]): void {
    if (nodeIds.length === 0) return;
    const EXPAND_PAD = 20;
    const nodesById = new Map(this.store.nodes().map(n => [n.id, n]));
    const annById = new Map(this.store.annotations().map(a => [a.id, a]));
    const shapeBoundsById = new Map<string, { left: number; top: number; right: number; bottom: number }>();

    for (const nodeId of nodeIds) {
      const node = nodesById.get(nodeId);
      const shapeId = node?.custom?.boundShapeAnnotationId;
      if (!node || !shapeId) continue;
      const shape = annById.get(shapeId);
      if (!shape || (shape.type !== 'rect' && shape.type !== 'ellipse' && shape.type !== 'diamond')) continue;
      const width = shape.width ?? 0;
      const height = shape.height ?? 0;
      if (width <= 0 || height <= 0) continue;

      const current = shapeBoundsById.get(shapeId) ?? {
        left: shape.x,
        top: shape.y,
        right: shape.x + width,
        bottom: shape.y + height,
      };
      const nodeLeft = node.position.x - EXPAND_PAD;
      const nodeTop = node.position.y - EXPAND_PAD;
      const nodeRight = node.position.x + node.size.width + EXPAND_PAD;
      const nodeBottom = node.position.y + node.size.height + EXPAND_PAD;
      current.left = Math.min(current.left, nodeLeft);
      current.top = Math.min(current.top, nodeTop);
      current.right = Math.max(current.right, nodeRight);
      current.bottom = Math.max(current.bottom, nodeBottom);
      shapeBoundsById.set(shapeId, current);
    }

    if (shapeBoundsById.size === 0) return;
    this.store.setAnnotations(this.store.annotations().map(a => {
      const nextBounds = shapeBoundsById.get(a.id);
      if (!nextBounds) return a;
      const nextWidth = Math.max(20, nextBounds.right - nextBounds.left);
      const nextHeight = Math.max(20, nextBounds.bottom - nextBounds.top);
      return {
        ...a,
        x: nextBounds.left,
        y: nextBounds.top,
        width: nextWidth,
        height: nextHeight,
      };
    }));
  }

  private isDescendantNode(startId: string, targetId: string, byId: Map<string, DiagramNode>): boolean {
    const queue = [...(byId.get(startId)?.children ?? [])];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === targetId) return true;
      if (seen.has(currentId)) continue;
      seen.add(currentId);
      const current = byId.get(currentId);
      if (current?.children?.length) queue.push(...current.children);
    }
    return false;
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
    // Snapshot state BEFORE any changes so that undo restores both the old
    // rule list and the pre-rule node colors in one atomic step.
    this.store.pushUndo();
    this.store.tagRules.set(rules);
    this.store.setNodes(this.applyInternalItemStyleRulesToNodes(this.store.nodes(), rules));
    this.recomputeTagHighlights(this.store.nodes());
  }

  /**
   * Computes the effective color/backgroundColor of every internal label item
   * by applying the current (or provided) internal-item style rules on top of
   * each item's *base* colors. Returns a new nodes array only when at least one
   * item actually changed; otherwise returns the same array reference so callers
   * can skip an unnecessary `setNodes` call.
   *
   * Base colors (`baseColor` / `baseBackgroundColor`) are the user's original
   * intent. They are written once the first time an item is processed and are
   * never overwritten by rule application, so removing a rule always reverts
   * the item to its pre-rule appearance.
   */
  private applyInternalItemStyleRulesToNodes(nodes: DiagramNode[], rules?: TagRule[]): DiagramNode[] {
    const internalRules = (rules ?? this.store.tagRules()).filter(r => r.type === 'internal-item');
    let anyNodeChanged = false;
    const nextNodes = nodes.map(node => {
      const items = node.custom?.internalItems;
      if (!items?.length) return node;
      let nodeChanged = false;
      const nextItems = items.map(item => {
        // Resolve the base color: use the stored base if available, otherwise
        // lazily initialise it from the current color (backward-compat with
        // items created before base-color tracking was introduced).
        //
        // We intentionally use the `in` operator rather than nullish coalescing
        // (`item.baseColor ?? item.color`) because there is a meaningful
        // difference between "the field does not exist" (legacy item — use the
        // current color as the base) and "the field exists but is undefined"
        // (item that had no color before a rule applied one). The latter case
        // must revert to `undefined` when the rule is removed; falling back to
        // `item.color` there would return the rule-applied color instead.
        const baseColor = 'baseColor' in item ? item.baseColor : item.color;
        const baseBackground = 'baseBackgroundColor' in item ? item.baseBackgroundColor : item.backgroundColor;

        // Start from base colors, then let matching rules override.
        let nextColor = baseColor;
        let nextBackground = baseBackground;
        const text = (item.text ?? '').toLowerCase();
        for (const rule of internalRules) {
          const query = (rule.textQuery ?? '').trim().toLowerCase();
          if (query && !text.includes(query)) continue;
          if (rule.textColor) nextColor = rule.textColor;
          if (rule.backgroundColor) nextBackground = rule.backgroundColor;
        }

        const nextItem = {
          ...item,
          baseColor,
          baseBackgroundColor: baseBackground,
          color: nextColor,
          backgroundColor: nextBackground,
        };

        // Return the original reference when nothing actually changed.
        if (
          nextItem.color === item.color &&
          nextItem.backgroundColor === item.backgroundColor &&
          nextItem.baseColor === item.baseColor &&
          nextItem.baseBackgroundColor === item.baseBackgroundColor
        ) {
          return item;
        }
        nodeChanged = true;
        return nextItem;
      });
      if (!nodeChanged) return node;
      anyNodeChanged = true;
      return { ...node, custom: { ...(node.custom ?? {}), internalItems: nextItems } };
    });
    return anyNodeChanged ? nextNodes : nodes;
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
      const tagKey = rule.tagKey ?? '';
      const tagValue = rule.tagValue ?? '';
      const operator = rule.operator ?? 'eq';
      switch (rule.operator) {
        case 'exists':    return tags.has(tagKey);
        case 'notexists': return !tags.has(tagKey);
        case 'eq':        return tags.get(tagKey)?.has(tagValue) ?? false;
        case 'neq':       return !(tags.get(tagKey)?.has(tagValue) ?? false);
        case 'contains':  return Array.from(tags.get(tagKey) ?? []).some(v => v.includes(tagValue));
        default:          return operator === 'eq' ? (tags.get(tagKey)?.has(tagValue) ?? false) : false;
      }
    };

    const toHighlight = (rule: TagRule): TagHighlightInfo => ({
      ruleId: rule.id,
      borderColor: rule.color ?? '#ef4444',
      bgColor: (rule.color ?? '#ef4444') + '22',
      badgeLabel: rule.badgeLabel,
      sizeOffset: rule.sizeOffset,
    });

    for (const rule of rules) {
      if (rule.type === 'internal-item') continue;
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
            this.nodeTagHighlights.set(nodeId, rule.color ?? '#ef4444');
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

  onDrawnContainerMouseDown(event: MouseEvent, annotationId: string): void {
    const ann = this.store.annotations().find(a => a.id === annotationId);
    if (!ann) return;
    this.onAnnotationMouseDown(event, ann);
  }

  onK8sNamespaceMouseDown(event: MouseEvent, nsId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    this.k8sNamespaceDragState = { nsId, lastX: event.clientX, lastY: event.clientY };
  }

  onK8sScopeMouseDown(event: MouseEvent, scopeId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    this.k8sScopeDragState = { scopeId, lastX: event.clientX, lastY: event.clientY };
  }

  onK8sClusterMouseDown(event: MouseEvent, clusterId: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    this.k8sClusterDragState = { clusterId, lastX: event.clientX, lastY: event.clientY };
  }

  onNodeMouseDown(event: MouseEvent, node: DiagramNode): void {
    if (this.activeTool !== 'pointer') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-node-resize-handle], [data-node-rotate-handle]')) return;
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

  private updateDrawBindPreviewPorts(pt: { x: number; y: number }): void {
    if (this.activeTool !== 'arrow') {
      this.clearDrawBindPreviewPorts();
      return;
    }

    const MAX_NODE_PROXIMITY = 28;
    let nearestNode: DiagramNode | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;

    for (const node of this.visibleNodes) {
      const dx = Math.max(node.position.x - pt.x, 0, pt.x - (node.position.x + node.size.width));
      const dy = Math.max(node.position.y - pt.y, 0, pt.y - (node.position.y + node.size.height));
      const d = Math.hypot(dx, dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearestNode = node;
      }
    }

    if (!nearestNode || nearestDist > MAX_NODE_PROXIMITY) {
      this.clearDrawBindPreviewPorts();
      return;
    }

    const ports = (nearestNode.ports ?? defaultNodePorts())
      .map(port => {
        const pos = portPosition(nearestNode, port.id);
        return pos ? { nodeId: nearestNode.id, portId: port.id, x: pos.x, y: pos.y } : null;
      })
      .filter((p): p is { nodeId: string; portId: string; x: number; y: number } => !!p);

    this.drawBindPreviewPorts = ports;
    const SNAP_DISTANCE = 18;
    let best: { portId: string; d: number } | null = null;
    for (const p of ports) {
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d <= SNAP_DISTANCE && (!best || d < best.d)) best = { portId: p.portId, d };
    }
    this.drawBindPreviewActivePortId = best?.portId ?? null;
  }

  private clearDrawBindPreviewPorts(): void {
    this.drawBindPreviewPorts = [];
    this.drawBindPreviewActivePortId = null;
  }

  private nearestNodePortAtPoint(
    pt: { x: number; y: number },
    maxDistance: number,
  ): { nodeId: string; portId: string; x: number; y: number } | null {
    let best: { nodeId: string; portId: string; x: number; y: number; d: number } | null = null;
    for (const node of this.visibleNodes) {
      for (const port of node.ports ?? defaultNodePorts()) {
        const pos = portPosition(node, port.id);
        if (!pos) continue;
        const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
        if (d > maxDistance) continue;
        if (!best || d < best.d) {
          best = { nodeId: node.id, portId: port.id, x: pos.x, y: pos.y, d };
        }
      }
    }
    return best ? { nodeId: best.nodeId, portId: best.portId, x: best.x, y: best.y } : null;
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

  private portAtCanvasPoint(x: number, y: number): { nodeId?: string; annotationId?: string; portId: string } | null {
    const HIT_R = 12;
    const PORT_IDS = ['port-top', 'port-right', 'port-bottom', 'port-left'];
    for (const node of this.store.nodes()) {
      for (const port of node.ports ?? defaultNodePorts()) {
        const pos = portPosition(node, port.id);
        if (!pos) continue;
        if (Math.hypot(pos.x - x, pos.y - y) <= HIT_R) {
          return { nodeId: node.id, portId: port.id };
        }
      }
    }
    for (const ann of this.store.annotations()) {
      if (!CONNECTABLE_ANNOTATION_TYPES.has(ann.type)) continue;
      for (const portId of PORT_IDS) {
        const pos = annotationPortPosition(ann, portId);
        if (!pos) continue;
        if (Math.hypot(pos.x - x, pos.y - y) <= HIT_R) {
          return { annotationId: ann.id, portId };
        }
      }
    }
    return null;
  }

  onPortMouseDown(event: MouseEvent, node: DiagramNode, portId: string): void {
    event.preventDefault();
    event.stopPropagation();
    const pos = portPosition(node, portId);
    if (!pos) return;
    this.edgeLinkDragState = {
      sourceNodeId: node.id,
      sourcePortId: portId,
      sourceX: pos.x,
      sourceY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    };
  }

  onAnnPortMouseDown(event: MouseEvent, ann: Annotation, portId: string): void {
    event.preventDefault();
    event.stopPropagation();
    const pos = annotationPortPosition(ann, portId);
    if (!pos) return;
    this.edgeLinkDragState = {
      sourceAnnotationId: ann.id,
      sourcePortId: portId,
      sourceX: pos.x,
      sourceY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    };
  }

  get zoomLevel(): number {
    return this.facade.viewport.zoomLevel;
  }

  get zoomPercent(): number {
    return this.facade.viewport.zoomPercent;
  }

  zoomIn(): void {
    this.facade.viewport.zoomIn(this.canvasHostRef?.nativeElement as HTMLElement | undefined);
  }

  zoomOut(): void {
    this.facade.viewport.zoomOut(this.canvasHostRef?.nativeElement as HTMLElement | undefined);
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
    return this.facade.edge.getSelectedEdge(this.selectedEdgeId);
  }

  onEdgeClick(event: MouseEvent, edge: DiagramEdge): void {
    const edgeId = this.facade.edge.onEdgeClick(event, edge, this.activeTool);
    if (!edgeId) return;
    this.selectedAnnotationId = null;
    this.selectedAnnotationIds = [];
    this.store.selectNode(null);
    this.selectedEdgeId = edgeId;
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
    this.edgeWaypointDragState = this.facade.edge.onEdgeWaypointMouseDown(e, edge, waypointIndex, event => this.svgPoint(event));
  }

  onEdgeMidpointMouseDown(e: MouseEvent, edge: DiagramEdge, segmentIndex: number): void {
    this.edgeWaypointDragState = this.facade.edge.onEdgeMidpointMouseDown(e, edge, segmentIndex, event => this.svgPoint(event));
  }

  onEdgeWaypointDblClick(e: MouseEvent, edge: DiagramEdge, waypointIndex: number): void {
    this.facade.edge.onEdgeWaypointDblClick(e, edge, waypointIndex);
  }

  onAnnWaypointMouseDown(e: MouseEvent, ann: Annotation, waypointIndex: number): void {
    e.stopPropagation();
    e.preventDefault();
    this.store.pushUndo();
    const pt = this.svgPoint(e);
    this.annWaypointDragState = { annId: ann.id, waypointIndex, lastX: pt.x, lastY: pt.y };
  }

  onAnnEndpointMouseDown(e: MouseEvent, ann: Annotation, endpoint: 'start' | 'end'): void {
    e.stopPropagation();
    e.preventDefault();
    this.store.pushUndo();
    const pt = this.svgPoint(e);
    this.annEndpointDragState = { annId: ann.id, endpoint, lastX: pt.x, lastY: pt.y };
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
    this.facade.edge.updateSelectedEdgeStyle(this.selectedEdgeId, changes);
  }

  setSelectedEdgeDashStyle(style: string): void {
    this.facade.edge.setSelectedEdgeDashStyle(this.selectedEdgeId, style);
  }

  setSelectedEdgeMarker(value: string): void {
    this.facade.edge.setSelectedEdgeMarker(this.selectedEdgeId, value);
  }

  setSelectedEdgeAnimated(animated: boolean): void {
    this.facade.edge.setSelectedEdgeAnimated(this.selectedEdgeId, animated);
  }

  resetSelectedEdgeStyle(): void {
    this.facade.edge.resetSelectedEdgeStyle(this.selectedEdgeId);
  }

  setSelectedEdgeLabel(label: string): void {
    this.facade.edge.setSelectedEdgeLabel(this.selectedEdgeId, label);
  }

  dashStyleValue(style: EdgeStyle): string {
    return this.facade.edge.dashStyleValue(style);
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
    // Opaque block annotations (image, text, sticky) always show their own
    // context menu so "Bring to front / Send to back" is reachable even when
    // they overlap a node. Transparent annotations still defer to the node.
    const isOpaqueAnnotation = ann.type === 'image' || ann.type === 'text' || ann.type === 'sticky';
    if (!isOpaqueAnnotation) {
      const canvasPt = this.canvasPointFromClient(event.clientX, event.clientY);
      const nodeUnder = this.nodeAtCanvasPoint(canvasPt.x, canvasPt.y);
      if (nodeUnder) {
        event.preventDefault();
        event.stopPropagation();
        this.ctxMenuSvc.onContextMenuRequested({ nodeId: nodeUnder.id, x: event.clientX, y: event.clientY });
        return;
      }
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
    return this.facade.clipboard.canPasteAnyObject;
  }

  get canPasteNodeObjects(): boolean {
    return this.facade.clipboard.canPasteNodeObjects;
  }

  copySelectedCanvasObject(): boolean {
    return this.facade.clipboard.copySelectedCanvasObject({
      annotationContextMenuId: this.ctxMenuSvc.annotationContextMenu?.annotationId ?? null,
      contextMenuNodeId: this.ctxMenuSvc.contextMenu?.nodeId ?? null,
      selectedAnnotationId: this.selectedAnnotationId,
      selectedAnnotationIds: this.selectedAnnotationIds,
      closeContextMenu: () => this.closeContextMenu(),
      selectContextNode: nodeId => this.store.selectNodes([nodeId]),
      clearAnnotationSelection: () => {
        this.selectedAnnotationId = null;
        this.selectedAnnotationIds = [];
      },
      annotationById: id => this.annotationById(id),
    });
  }

  pasteCanvasClipboard(): boolean {
    return this.facade.clipboard.pasteCanvasClipboard({
      selectAnnotations: ids => {
        this.selectedAnnotationIds = ids;
        this.selectedAnnotationId = ids[0] ?? null;
      },
      clearEdgeSelection: () => {
        this.selectedEdgeId = null;
      },
      clearAnnotationsSelection: () => {
        this.selectedAnnotationId = null;
        this.selectedAnnotationIds = [];
      },
      syncToolbarFromAnnotation: annotation => this.syncToolbarFromAnnotation(annotation),
      closeContextMenu: () => this.closeContextMenu(),
    });
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

  openNodeDetails(nodeId: string): void {
    this.store.selectNode(nodeId, true);
  }

  breakOutNode(nodeId: string, parentId: string | null): void {
    this.store.pushUndo();
    if (parentId) {
      this.store.detachNodeFromParent(nodeId, parentId);
      return;
    }
    this.store.detachNodeFromResourceGroup(nodeId);
  }

  bindNode(nodeId: string): void {
    const action = this.nodeContainerActions.get(nodeId);
    if (!action || action.kind !== 'bind' || !action.targetType || !action.targetId) return;
    const targetId = action.targetId;
    const currentNodes = this.store.nodes();
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node) return;
    this.store.pushUndo();
    if (action.targetType === 'parent') {
      this.store.reattachNodeToParent(nodeId, targetId);
      return;
    }
    if (action.targetType === 'shape') {
      this.store.setNodes(currentNodes.map(n => {
        if (n.id !== nodeId) return n;
        return { ...n, custom: { ...(n.custom ?? {}), boundShapeAnnotationId: targetId } };
      }));
      return;
    }
    if (action.targetType === 'rg') {
      const splitIdx = targetId.indexOf('::');
      const targetSubscriptionId = splitIdx >= 0 ? targetId.slice(0, splitIdx) : '';
      const targetRgName = splitIdx >= 0 ? targetId.slice(splitIdx + 2) : targetId;
      this.store.setNodes(currentNodes.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          group: 'resourceGroup',
          groupId: targetRgName,
          metadata: {
            ...n.metadata,
            resourceGroup: targetRgName,
            subscriptionId: targetSubscriptionId || n.metadata?.subscriptionId,
          },
        };
      }));
    }
  }

  onNodeContainerAction(nodeId: string): void {
    const action = this.nodeContainerActions.get(nodeId);
    if (!action || action.kind === 'none' || action.kind === 'bind-disabled') return;
    if (action.kind === 'breakout') {
      if (action.targetType === 'shape') {
        this.store.pushUndo();
        this.store.setNodes(this.store.nodes().map(n => {
          if (n.id !== nodeId) return n;
          return { ...n, custom: { ...(n.custom ?? {}), boundShapeAnnotationId: undefined } };
        }));
        return;
      }
      const parentId = this.childToParentMap().get(nodeId) ?? null;
      this.breakOutNode(nodeId, parentId);
      return;
    }
    this.bindNode(nodeId);
  }

  canDetachFromResourceGroup(node: DiagramNode): boolean {
    return node.group === 'resourceGroup';
  }

  parentLabelForNode(node: DiagramNode): string | null {
    const shape = node.custom?.boundShapeAnnotationId
      ? this.store.annotations().find(a => a.id === node.custom!.boundShapeAnnotationId)
      : undefined;
    if (shape) return this.shapeLabel(shape);
    const parentId = this.childToParentMap().get(node.id);
    if (parentId) return this.parentLabelById().get(parentId) ?? 'container';
    if (this.canDetachFromResourceGroup(node)) return node.metadata?.resourceGroup || node.groupId || 'resource group';
    return null;
  }

  contextBindLabel(node: DiagramNode): string {
    return this.nodeContainerActions.get(node.id)?.label ?? '';
  }

  canBindFromContext(node: DiagramNode): boolean {
    const action = this.nodeContainerActions.get(node.id);
    return !!action && action.kind === 'bind';
  }

  bindTitleForNode(node: DiagramNode): string {
    return this.nodeContainerActions.get(node.id)?.title ?? '';
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
    const annId = this.ctxMenuSvc.annotationContextMenu.annotationId;
    this.clearShapeBinding(annId);
    this.store.deleteAnnotation(annId);
    if (this.selectedAnnotationId === annId) this.selectedAnnotationId = null;
    this.selectedAnnotationIds = this.selectedAnnotationIds.filter(id => id !== annId);
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
    // Apply the draft first, then re-apply internal-item style rules so that
    // any rules already configured are immediately reflected on the saved node.
    const nodesAfterDraft = this.resourceEditor.applyDraft(
      this.store.nodes(), this.resourceEditorNodeId, this.resourceEditorDraft,
    );
    this.store.setNodes(this.applyInternalItemStyleRulesToNodes(nodesAfterDraft));
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

  updateInternalItemColor(itemId: string, color: string): void {
    if (!this.resourceEditorDraft) return;
    this.resourceEditorDraft = this.resourceEditor.updateInternalItemColor(this.resourceEditorDraft, itemId, color);
  }

  updateInternalItemBackgroundColor(itemId: string, backgroundColor: string): void {
    if (!this.resourceEditorDraft) return;
    this.resourceEditorDraft = this.resourceEditor.updateInternalItemBackgroundColor(this.resourceEditorDraft, itemId, backgroundColor);
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
    this.expandBoundShapesForNodes([req.nodeId]);
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
    this.applyNodePanelExpansion(req.nodeId, req.expanded, heightFn(req), this.collapsedHeights, kind);
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
    panelKind?: string,
  ): void {
    const nextNodes = this.nodeExpansion.apply(this.store.nodes(), collapsedHeights, {
      nodeId,
      expanded,
      panelHeight,
    });
    if (!nextNodes) return;
    const persistedNodes = panelKind
      ? nextNodes.map(n => n.id === nodeId
        ? {
            ...n,
            custom: {
              ...(n.custom ?? {}),
              panelState: {
                ...(n.custom?.panelState ?? {}),
                [panelKind]: expanded,
              },
            },
          }
        : n)
      : nextNodes;
    this.store.pushUndo();
    this.store.setNodes(persistedNodes);
  }

  // ── Container rename ──────────────────────────────────────────────────────
  startRename(type: 'rg' | 'sub' | 'vm' | 'rt' | 'k8sns' | 'k8sscope' | 'k8scluster' | 'drawn', id: string, currentName: string): void {
    this.renamingContainer = { type, id };
    this.renamingValue = currentName;
  }

  commitRename(): void {
    if (!this.renamingContainer) return;
    const { type, id } = this.renamingContainer;
    const trimmed = this.renamingValue.trim();
    this.store.pushUndo();
    if (type === 'drawn') {
      const ann = this.store.annotations().find(a => a.id === id);
      if (ann?.container) {
        this.store.updateAnnotation(id, {
          container: {
            ...ann.container,
            name: trimmed || (ann.container.kind === 'rg' ? 'Resource Group' : 'Subscription'),
          },
        });
      }
      this.renamingContainer = null;
      this.renamingValue = '';
      this.refreshVisibility(this.store.nodes(), this.store.edges());
      return;
    }
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
    this.facade.viewport.setZoom(
      nextZoom,
      this.canvasHostRef?.nativeElement as HTMLElement | undefined,
      anchor,
    );
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
