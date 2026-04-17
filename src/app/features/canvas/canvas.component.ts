import { Component, inject, effect, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { ExportService } from '../../core/services/export.service';
import { CostService } from '../../core/services/cost.service';
import { DriftService } from '../../core/services/drift.service';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import { DiagramNodeComponent } from './diagram-node/diagram-node.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { DrawingToolbarComponent } from './drawing-toolbar/drawing-toolbar.component';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { Annotation, DrawingTool } from '../../core/models/annotation.model';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, DiagramNodeComponent, SidebarComponent, ToolbarComponent, DrawingToolbarComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-50 overflow-hidden">

      <app-toolbar
        [nodeCount]="store.nodeCount()"
        [edgeCount]="store.edgeCount()"
        [totalCost]="store.totalMonthlyCost()"
        [finOpsActive]="store.finOpsLayerActive()"
        [comparisonMode]="store.comparisonMode()"
        [driftSummary]="store.driftSummary()"
        (exportSvg)="exportSvg()"
        (exportPng)="exportPng()"
        (exportJson)="exportJson()"
        (toggleFinOps)="toggleFinOps()"
        (rescan)="rescan()"
        (unpinAll)="store.unpinAll()"
        (importJson)="onImportJson($event)"
        (toggleDrift)="toggleDrift()"
      />

      <div class="flex flex-1 overflow-hidden relative">

        <!-- Floating drawing toolbar (draggable) -->
        <div
          class="absolute z-50 pointer-events-auto select-none"
          [style.left.px]="toolbarPos.x"
          [style.top.px]="toolbarPos.y"
        >
          <!-- Drag handle -->
          <div
            class="flex justify-center pb-0.5 pt-0.5"
            [class.cursor-grab]="toolbarDragState === null"
            [class.cursor-grabbing]="toolbarDragState !== null"
            (mousedown)="onToolbarDragMouseDown($event)"
          >
            <div class="w-8 h-1 bg-gray-400 rounded-full opacity-50 hover:opacity-80 transition-opacity"></div>
          </div>
          <app-drawing-toolbar
            [activeTool]="activeTool"
            [activeColor]="activeColor"
            [activeStrokeWidth]="activeStrokeWidth"
            [activeFill]="activeFill"
            (toolChange)="setTool($event)"
            (colorChange)="activeColor = $event"
            (strokeWidthChange)="activeStrokeWidth = $event"
            (fillChange)="activeFill = $event"
            (undo)="store.undoLastAnnotation()"
            (clearAll)="store.clearAnnotations()"
          />
        </div>

        <div
          #canvasHost
          class="flex-1 relative overflow-auto bg-[#faf9f8]"
          style="background-image: radial-gradient(circle, #d2d0ce 1px, transparent 1px); background-size: 24px 24px;"
        >
          <div
            class="relative"
            [style.width.px]="canvasWidth"
            [style.height.px]="canvasHeight"
          >

            <!-- Resource group boxes -->
            @for (bound of rgBounds; track bound.name) {
              <div
                class="absolute rounded-xl border border-dashed border-blue-300 bg-blue-50/25 pointer-events-none"
                [style.left.px]="bound.x"
                [style.top.px]="bound.y"
                [style.width.px]="bound.width"
                [style.height.px]="bound.height"
              >
                <div
                  class="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5 rounded-t-xl select-none pointer-events-auto hover:bg-blue-100/50 transition-colors"
                  [class.cursor-grab]="activeTool === 'pointer' && !isRgDragging"
                  [class.cursor-grabbing]="isRgDragging && rgDragState?.name === bound.name"
                  [class.cursor-crosshair]="activeTool !== 'pointer'"
                  style="z-index: 20; height: 32px"
                  (mousedown)="onRgMouseDown($event, bound.name)"
                >
                  <img [src]="rgIconUrl" alt="" class="w-4 h-4 object-contain flex-shrink-0" (error)="$any($event.target).style.display='none'" />
                  <span class="text-xs font-semibold text-blue-500 tracking-wide truncate">{{ bound.name }}</span>
                </div>
              </div>
            }

            <!-- Azure resource nodes -->
            @for (node of visibleNodes; track node.id) {
              <div
                class="absolute"
                [style.left.px]="node.position.x"
                [style.top.px]="node.position.y"
                [style.pointer-events]="activeTool === 'pointer' ? 'auto' : 'none'"
                [class.cursor-grab]="activeTool === 'pointer' && nodeDragState?.id !== node.id"
                [class.cursor-grabbing]="nodeDragState?.id === node.id"
                (mousedown)="onNodeMouseDown($event, node)"
              >
                <app-diagram-node
                  [node]="node"
                  [finOpsActive]="store.finOpsLayerActive()"
                  (clicked)="store.selectNode($event)"
                  (pinToggled)="togglePin($event)"
                />
              </div>
            }

            <!-- SVG: edges + annotations + drawing layer (pointer-events-none so HTML elements below receive events; SVG children with explicit pointer-events still work) -->
            <svg
              class="absolute top-0 left-0 pointer-events-none"
              [attr.width]="canvasWidth"
              [attr.height]="canvasHeight"
            >
              <defs>
                <marker id="edge-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#605e5c" />
                </marker>
              </defs>

              <!-- Edges (pass-through) -->
              @for (edge of store.edges(); track edge.id) {
                <line
                  pointer-events="none"
                  [attr.x1]="getEdgeX1(edge.sourceId)"
                  [attr.y1]="getEdgeY1(edge.sourceId)"
                  [attr.x2]="getEdgeX2(edge.targetId)"
                  [attr.y2]="getEdgeY2(edge.targetId)"
                  [attr.stroke]="edge.style.strokeColor"
                  [attr.stroke-width]="edge.style.strokeWidth"
                  [attr.stroke-dasharray]="edge.style.dashArray ?? null"
                  [attr.marker-end]="edge.style.markerEnd === 'arrow' ? 'url(#edge-arrow)' : null"
                  [class.animate-pulse]="edge.animated"
                />
              }

              <!-- Saved annotations -->
              @for (ann of store.annotations(); track ann.id) {
                @if (ann.type === 'draw' && ann.pathData) {
                  <path
                    [attr.d]="ann.pathData"
                    [attr.stroke]="ann.color"
                    [attr.stroke-width]="ann.strokeWidth"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    [attr.pointer-events]="activeTool === 'pointer' ? 'stroke' : 'none'"
                    [class.cursor-move]="activeTool === 'pointer'"
                    (mousedown)="onAnnotationMouseDown($event, ann)"
                  />
                }
                @if (ann.type === 'arrow') {
                  <g
                    [attr.pointer-events]="activeTool === 'pointer' ? 'all' : 'none'"
                    [class.cursor-move]="activeTool === 'pointer'"
                    (mousedown)="onAnnotationMouseDown($event, ann)"
                  >
                    <line
                      [attr.x1]="ann.x" [attr.y1]="ann.y"
                      [attr.x2]="ann.x2 ?? ann.x" [attr.y2]="ann.y2 ?? ann.y"
                      [attr.stroke]="ann.color" [attr.stroke-width]="ann.strokeWidth"
                      stroke-linecap="round"
                    />
                    <path
                      [attr.d]="arrowHead(ann.x, ann.y, ann.x2 ?? ann.x, ann.y2 ?? ann.y)"
                      [attr.fill]="ann.color" stroke="none"
                    />
                    <!-- wider invisible hit area -->
                    <line
                      [attr.x1]="ann.x" [attr.y1]="ann.y"
                      [attr.x2]="ann.x2 ?? ann.x" [attr.y2]="ann.y2 ?? ann.y"
                      stroke="transparent" stroke-width="12"
                    />
                  </g>
                }
                @if (ann.type === 'rect' && ann.width && ann.height) {
                  <rect
                    [attr.x]="ann.x" [attr.y]="ann.y"
                    [attr.width]="ann.width" [attr.height]="ann.height"
                    [attr.stroke]="ann.color" [attr.stroke-width]="ann.strokeWidth"
                    [attr.fill]="ann.fill" rx="3"
                    [attr.pointer-events]="activeTool === 'pointer' ? 'all' : 'none'"
                    [class.cursor-move]="activeTool === 'pointer'"
                    (mousedown)="onAnnotationMouseDown($event, ann)"
                  />
                }
                @if (ann.type === 'ellipse' && ann.width && ann.height) {
                  <ellipse
                    [attr.cx]="ann.x + ann.width / 2"
                    [attr.cy]="ann.y + ann.height / 2"
                    [attr.rx]="ann.width / 2"
                    [attr.ry]="ann.height / 2"
                    [attr.stroke]="ann.color" [attr.stroke-width]="ann.strokeWidth"
                    [attr.fill]="ann.fill"
                    [attr.pointer-events]="activeTool === 'pointer' ? 'all' : 'none'"
                    [class.cursor-move]="activeTool === 'pointer'"
                    (mousedown)="onAnnotationMouseDown($event, ann)"
                  />
                }
                <!-- Selection highlight -->
                @if (selectedAnnotationId === ann.id && activeTool === 'pointer') {
                  @if (ann.type === 'rect' || ann.type === 'ellipse') {
                    <rect
                      [attr.x]="ann.x - 4" [attr.y]="ann.y - 4"
                      [attr.width]="(ann.width ?? 0) + 8" [attr.height]="(ann.height ?? 0) + 8"
                      fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 3" rx="5"
                      pointer-events="none"
                    />
                  }
                }
              }

              <!-- In-progress drawing previews -->
              @if (previewPath) {
                <path [attr.d]="previewPath"
                  [attr.stroke]="activeColor" [attr.stroke-width]="activeStrokeWidth"
                  fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />
              }
              @if (previewArrow) {
                <g pointer-events="none">
                  <line [attr.x1]="previewArrow.x1" [attr.y1]="previewArrow.y1"
                    [attr.x2]="previewArrow.x2" [attr.y2]="previewArrow.y2"
                    [attr.stroke]="activeColor" [attr.stroke-width]="activeStrokeWidth"
                    stroke-dasharray="6 3" stroke-linecap="round" />
                  <path [attr.d]="arrowHead(previewArrow.x1, previewArrow.y1, previewArrow.x2, previewArrow.y2)"
                    [attr.fill]="activeColor" stroke="none" />
                </g>
              }
              @if (previewRect) {
                <rect [attr.x]="previewRect.x" [attr.y]="previewRect.y"
                  [attr.width]="previewRect.w" [attr.height]="previewRect.h"
                  [attr.stroke]="activeColor" [attr.stroke-width]="activeStrokeWidth"
                  [attr.fill]="activeFill" stroke-dasharray="6 3" rx="3" pointer-events="none" />
              }
              @if (previewEllipse) {
                <ellipse
                  [attr.cx]="previewEllipse.cx" [attr.cy]="previewEllipse.cy"
                  [attr.rx]="previewEllipse.rx" [attr.ry]="previewEllipse.ry"
                  [attr.stroke]="activeColor" [attr.stroke-width]="activeStrokeWidth"
                  [attr.fill]="activeFill" stroke-dasharray="6 3" pointer-events="none" />
              }

            </svg>

            <!-- HTML drawing overlay: captures events when a drawing tool is active -->
            @if (activeTool !== 'pointer') {
              <div
                class="absolute top-0 left-0"
                [style.width.px]="canvasWidth"
                [style.height.px]="canvasHeight"
                style="z-index: 60; cursor: crosshair"
                (mousedown)="onDrawMouseDown($event)"
                (mousemove)="onDrawMouseMove($event)"
                (mouseup)="onDrawMouseUp($event)"
              ></div>
            }

            <!-- HTML overlays: text + sticky annotations -->
            @for (ann of store.annotations(); track ann.id) {
              @if (ann.type === 'text' || ann.type === 'sticky') {
                <div
                  class="absolute select-none whitespace-pre-wrap break-words"
                  [class.p-3]="ann.type === 'sticky'"
                  [class.rounded-lg]="ann.type === 'sticky'"
                  [class.shadow-md]="ann.type === 'sticky'"
                  [class.border]="ann.type === 'sticky'"
                  [class.border-yellow-300]="ann.type === 'sticky'"
                  [class.bg-yellow-100]="ann.type === 'sticky'"
                  [class.ring-2]="selectedAnnotationId === ann.id"
                  [class.ring-blue-400]="selectedAnnotationId === ann.id"
                  [style.left.px]="ann.x"
                  [style.top.px]="ann.y"
                  [style.min-width.px]="120"
                  [style.min-height.px]="ann.type === 'sticky' ? 80 : 20"
                  [style.font-size.px]="ann.fontSize ?? 14"
                  [style.color]="ann.color"
                  [style.pointer-events]="activeTool === 'pointer' ? 'auto' : 'none'"
                  [style.cursor]="activeTool === 'pointer' ? 'move' : 'default'"
                  (mousedown)="onAnnotationMouseDown($event, ann)"
                  (dblclick)="startEditAnnotation(ann)"
                >{{ ann.text || '…' }}</div>
              }
            }

            <!-- Annotation delete button (selected annotation) -->
            @if (selectedAnnotationId && activeTool === 'pointer') {
              @let selAnn = annotationById(selectedAnnotationId);
              @if (selAnn) {
                <button
                  class="absolute z-50 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                  [style.left.px]="annDeleteBtnX(selAnn)"
                  [style.top.px]="annDeleteBtnY(selAnn)"
                  (mousedown)="$event.stopPropagation()"
                  (click)="deleteSelectedAnnotation()"
                  title="Delete annotation (Del)"
                >✕</button>
              }
            }

            <!-- Text/sticky editing overlay -->
            @if (editingAnnotation) {
              <textarea
                #editTextarea
                class="absolute z-50 resize p-1.5 rounded border-2 border-blue-400 shadow-lg outline-none bg-white/90 text-sm"
                [style.left.px]="editingAnnotation.x"
                [style.top.px]="editingAnnotation.y"
                [style.min-width.px]="160"
                [style.min-height.px]="editingAnnotation.type === 'sticky' ? 80 : 36"
                [style.font-size.px]="editingAnnotation.fontSize ?? 14"
                [style.color]="editingAnnotation.color"
                [value]="editingTextValue"
                placeholder="Type here…"
                (input)="editingTextValue = $any($event.target).value"
                (blur)="finishEdit()"
                (keydown)="onEditKeyDown($event)"
                (mousedown)="$event.stopPropagation()"
              ></textarea>
            }

          </div>
        </div>

        @if (store.sidebarOpen()) {
          <app-sidebar />
        }
      </div>
    </div>
  `,
})
export class CanvasComponent {
  @ViewChild('canvasHost', { read: ElementRef }) canvasHostRef!: ElementRef;
  @ViewChild('editTextarea') editTextareaRef?: ElementRef;

  store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  private exportSvc = inject(ExportService);
  private costSvc = inject(CostService);
  private driftSvc = inject(DriftService);
  private router = inject(Router);
  readonly rgIconUrl = inject(IconRegistryService).getIconUrl('microsoft.resources/resourcegroups');

  // ── Layout ─────────────────────────────────────────────────────────────────
  visibleNodes: DiagramNode[] = [];
  rgBounds: RgBound[] = [];
  private rgDragStart = { clientX: 0, clientY: 0 };

  constructor() {
    effect(() => {
      const nodes = this.store.nodes();
      this.visibleNodes = nodes;
      this.rgBounds = this.computeRgBounds(nodes);
    });
  }

  // ── Drawing tool state ─────────────────────────────────────────────────────
  activeTool: DrawingTool = 'pointer';
  activeColor = '#1e1e1e';
  activeStrokeWidth = 2;
  activeFill = 'none';

  selectedAnnotationId: string | null = null;
  editingAnnotation: Annotation | null = null;
  editingTextValue = '';

  // In-progress drawing previews
  previewPath = '';
  previewArrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewRect: { x: number; y: number; w: number; h: number } | null = null;
  previewEllipse: { cx: number; cy: number; rx: number; ry: number } | null = null;

  // Internal drawing state
  private isDrawing = false;
  private drawPoints: Array<[number, number]> = [];
  private shapeStart: { x: number; y: number } | null = null;

  // Annotation drag state
  private annDragId: string | null = null;
  private annDragMouse = { x: 0, y: 0 };
  private annDragOrigin = { x: 0, y: 0, x2: 0, y2: 0 };

  // RG mouse drag (smooth, incremental)
  rgDragState: { name: string; lastX: number; lastY: number } | null = null;
  get isRgDragging(): boolean { return this.rgDragState !== null; }

  // Individual node mouse drag
  nodeDragState: { id: string; lastX: number; lastY: number; hasMoved: boolean } | null = null;

  // Floating toolbar drag
  toolbarPos = { x: 12, y: 12 };
  toolbarDragState: { lastX: number; lastY: number } | null = null;

  // Node HTML5 drag
  private dragOffset = { x: 0, y: 0 };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedAnnotationId) {
      this.deleteSelectedAnnotation();
    }
    if (e.key === 'Escape') {
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
      const dx = e.clientX - this.nodeDragState.lastX;
      const dy = e.clientY - this.nodeDragState.lastY;
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

    // RG group drag — incremental delta so position tracks the cursor exactly
    if (this.rgDragState) {
      const dx = e.clientX - this.rgDragState.lastX;
      const dy = e.clientY - this.rgDragState.lastY;
      if (dx !== 0 || dy !== 0) {
        this.store.moveNodeGroup(this.rgDragState.name, { dx, dy });
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
      this.store.updateAnnotation(this.annDragId, {
        x: this.annDragOrigin.x + dx,
        y: this.annDragOrigin.y + dy,
        x2: this.annDragOrigin.x2 ? this.annDragOrigin.x2 + dx : undefined,
        y2: this.annDragOrigin.y2 ? this.annDragOrigin.y2 + dy : undefined,
      });
    }
  }

  @HostListener('document:mouseup')
  onDocMouseUp(): void {
    this.toolbarDragState = null;
    this.rgDragState = null;
    this.nodeDragState = null;
    this.annDragId = null;
  }

  // ── Tool management ────────────────────────────────────────────────────────
  setTool(tool: DrawingTool): void {
    this.activeTool = tool;
    this.selectedAnnotationId = null;
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
      } else if (this.activeTool === 'rect') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        this.previewRect = r;
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
      } else if (this.activeTool === 'rect') {
        const r = this.normalizeRect(s.x, s.y, pt.x, pt.y);
        if (r.w > 4 && r.h > 4) {
          this.store.addAnnotation({ ...this.newAnnotation('rect', r.x, r.y), width: r.w, height: r.h, fill: this.activeFill });
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
    this.selectedAnnotationId = ann.id;
    const pt = this.svgPoint(e);
    this.annDragId = ann.id;
    this.annDragMouse = { x: pt.x, y: pt.y };
    this.annDragOrigin = { x: ann.x, y: ann.y, x2: ann.x2 ?? 0, y2: ann.y2 ?? 0 };
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

  // ── Annotation helpers ─────────────────────────────────────────────────────
  annotationById(id: string): Annotation | undefined {
    return this.store.annotations().find(a => a.id === id);
  }

  annDeleteBtnX(ann: Annotation): number {
    if (ann.type === 'arrow') return Math.max(ann.x, ann.x2 ?? ann.x) + 8;
    return ann.x + (ann.width ?? 120) + 4;
  }

  annDeleteBtnY(ann: Annotation): number {
    if (ann.type === 'arrow') return Math.min(ann.y, ann.y2 ?? ann.y) - 10;
    return ann.y - 10;
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
    const map = new Map<string, DiagramNode[]>();
    for (const n of nodes) {
      const rg = n.metadata?.resourceGroup || n.groupId || '';
      if (!rg) continue;
      if (!map.has(rg)) map.set(rg, []);
      map.get(rg)!.push(n);
    }
    return Array.from(map.entries()).map(([name, rgNodes]) => ({
      name,
      x: Math.min(...rgNodes.map(n => n.position.x)) - PAD,
      y: Math.min(...rgNodes.map(n => n.position.y)) - PAD - LABEL_H,
      width: Math.max(...rgNodes.map(n => n.position.x + n.size.width)) + PAD - (Math.min(...rgNodes.map(n => n.position.x)) - PAD),
      height: Math.max(...rgNodes.map(n => n.position.y + n.size.height)) + PAD - (Math.min(...rgNodes.map(n => n.position.y)) - PAD - LABEL_H),
    }));
  }

  // ── Toolbar drag ───────────────────────────────────────────────────────────
  onToolbarDragMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.toolbarDragState = { lastX: e.clientX, lastY: e.clientY };
  }

  // ── Node drag ──────────────────────────────────────────────────────────────
  onRgMouseDown(event: MouseEvent, rgName: string): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.rgDragState = { name: rgName, lastX: event.clientX, lastY: event.clientY };
  }

  onNodeMouseDown(event: MouseEvent, node: DiagramNode): void {
    if (this.activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
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
    const x = event.clientX - rect.left - this.dragOffset.x + canvas.scrollLeft;
    const y = event.clientY - rect.top - this.dragOffset.y + canvas.scrollTop;
    this.store.moveNode(node.id, { x: Math.max(0, x), y: Math.max(0, y) });
  }

  // ── Edge helpers ───────────────────────────────────────────────────────────
  getEdgeX1(nodeId: string): number { const n = this.store.nodes().find(n => n.id === nodeId); return n ? n.position.x + n.size.width / 2 : 0; }
  getEdgeY1(nodeId: string): number { const n = this.store.nodes().find(n => n.id === nodeId); return n ? n.position.y + n.size.height / 2 : 0; }
  getEdgeX2 = this.getEdgeX1.bind(this);
  getEdgeY2 = this.getEdgeY1.bind(this);

  // ── Misc ───────────────────────────────────────────────────────────────────
  togglePin(nodeId: string): void {
    const node = this.store.nodes().find(n => n.id === nodeId);
    if (!node) return;
    node.isPinned ? this.store.unpinNode(nodeId) : this.store.pinNode(nodeId);
  }

  async toggleFinOps(): Promise<void> {
    const active = !this.store.finOpsLayerActive();
    this.store.finOpsLayerActive.set(active);
    if (active && !this.store.nodes().some(n => n.costData)) {
      const subIds = this.store.activeSubscriptions().map(s => s.subscriptionId);
      if (subIds.length === 0) return;
      const costs = await this.costSvc.getSubscriptionCosts(subIds[0]).toPromise();
      if (costs) this.store.setNodes(this.costSvc.enrichNodesWithCosts(this.store.nodes(), costs));
    }
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
    return { x: e.clientX - rect.left + host.scrollLeft, y: e.clientY - rect.top + host.scrollTop };
  }

  private newAnnotation(type: Annotation['type'], x: number, y: number): Annotation {
    return {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type, color: this.activeColor, strokeWidth: this.activeStrokeWidth,
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
    this.previewRect = null;
    this.previewEllipse = null;
  }
}

interface RgBound { name: string; x: number; y: number; width: number; height: number; }
