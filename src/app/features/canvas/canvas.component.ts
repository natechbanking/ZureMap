import { Component, inject, effect, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { ExportService } from '../../core/services/export.service';
import { CostService } from '../../core/services/cost.service';
import { DriftService } from '../../core/services/drift.service';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import { DiagramNodeComponent, ContextMenuRequest } from './diagram-node/diagram-node.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { DrawingToolbarComponent } from './drawing-toolbar/drawing-toolbar.component';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { Annotation, DrawingTool } from '../../core/models/annotation.model';
import { forkJoin, firstValueFrom } from 'rxjs';

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
          class="absolute z-[120] pointer-events-auto select-none"
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
            [hasSelection]="selectedAnnotationId !== null"
            [annotationCount]="store.annotations().length"
            (toolChange)="setTool($event)"
            (colorChange)="activeColor = $event"
            (strokeWidthChange)="activeStrokeWidth = $event"
            (fillChange)="activeFill = $event"
            (undo)="store.undoLastAnnotation()"
            (clearAll)="clearAllAnnotations()"
            (deleteSelected)="deleteSelectedAnnotation()"
          />
        </div>

        <div
          #canvasHost
          class="flex-1 relative overflow-auto bg-[#faf9f8]"
          style="background-image: radial-gradient(circle, #d2d0ce 1px, transparent 1px); background-size: 24px 24px;"
          (wheel)="onCanvasWheel($event)"
        >
          <div
            class="relative"
            [style.width.px]="canvasWidth * zoomLevel"
            [style.height.px]="canvasHeight * zoomLevel"
          >
            <div
              class="absolute top-0 left-0 origin-top-left"
            [style.width.px]="canvasWidth"
            [style.height.px]="canvasHeight"
              [style.transform]="'scale(' + zoomLevel + ')'"
          >

            <!-- Subscription boxes (shown for multi-subscription views) -->
            @for (bound of subscriptionBounds; track bound.id) {
              <div
                class="absolute rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/30 pointer-events-none"
                [style.left.px]="bound.x"
                [style.top.px]="bound.y"
                [style.width.px]="bound.width"
                [style.height.px]="bound.height"
              >
                <div
                  class="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-2 rounded-t-2xl select-none pointer-events-auto hover:bg-amber-100/60 transition-colors"
                  [class.cursor-grab]="activeTool === 'pointer' && !isSubscriptionDragging"
                  [class.cursor-grabbing]="isSubscriptionDragging && subscriptionDragState?.subscriptionId === bound.subscriptionId"
                  [class.cursor-crosshair]="activeTool !== 'pointer'"
                  style="z-index: 10; height: 36px"
                  (mousedown)="onSubscriptionMouseDown($event, bound.subscriptionId)"
                >
                  <img [src]="subscriptionIconUrl" alt="" class="w-4 h-4 object-contain flex-shrink-0 opacity-90" (error)="$any($event.target).style.display='none'" />
                  <span class="text-xs font-semibold text-amber-700 tracking-wide truncate">{{ bound.name }}</span>
                  <button
                    type="button"
                    class="ml-auto w-5 h-5 rounded text-amber-700 hover:bg-amber-200/70 transition-colors"
                    [title]="bound.collapsed ? 'Expand subscription' : 'Collapse subscription'"
                    (mousedown)="$event.stopPropagation()"
                    (click)="toggleSubscriptionCollapsed(bound.subscriptionId); $event.stopPropagation()"
                  >
                    {{ bound.collapsed ? '+' : '-' }}
                  </button>
                </div>
              </div>
            }

            <!-- Resource group boxes -->
            @for (bound of rgBounds; track bound.id) {
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
                  [class.cursor-grabbing]="isRgDragging && rgDragState?.id === bound.id"
                  [class.cursor-crosshair]="activeTool !== 'pointer'"
                  style="z-index: 20; height: 32px"
                  (mousedown)="onRgMouseDown($event, bound.id)"
                >
                  <img [src]="rgIconUrl" alt="" class="w-4 h-4 object-contain flex-shrink-0" (error)="$any($event.target).style.display='none'" />
                  <span class="text-xs font-semibold text-blue-500 tracking-wide truncate">{{ bound.name }}</span>
                  <button
                    type="button"
                    class="ml-auto w-5 h-5 rounded text-blue-600 hover:bg-blue-200/70 transition-colors"
                    [title]="bound.collapsed ? 'Expand resource group' : 'Collapse resource group'"
                    (mousedown)="$event.stopPropagation()"
                    (click)="toggleRgCollapsed(bound.id); $event.stopPropagation()"
                  >
                    {{ bound.collapsed ? '+' : '-' }}
                  </button>
                </div>
              </div>
            }

            <!-- VM sub-containers (VM + related resources) -->
            @for (bound of vmBounds; track bound.id) {
              <div
                class="absolute rounded-lg border border-dashed border-slate-300 bg-slate-50/40 pointer-events-none"
                [style.left.px]="bound.x"
                [style.top.px]="bound.y"
                [style.width.px]="bound.width"
                [style.height.px]="bound.height"
              >
                <div
                  class="absolute top-0 left-0 right-0 flex items-center gap-2 px-2 py-1 text-[10px] font-semibold text-slate-500 bg-slate-100/70 rounded-t-lg select-none pointer-events-auto"
                  [class.cursor-grab]="activeTool === 'pointer' && !isVmDragging"
                  [class.cursor-grabbing]="isVmDragging && vmDragState?.vmId === bound.id"
                  [class.cursor-crosshair]="activeTool !== 'pointer'"
                  style="z-index: 25; height: 24px"
                  (mousedown)="onVmMouseDown($event, bound.id)"
                >
                  <span class="truncate">VM Group: {{ bound.name }}</span>
                  <button
                    type="button"
                    class="ml-auto w-4 h-4 rounded text-slate-600 hover:bg-slate-200/70 transition-colors"
                    [title]="bound.collapsed ? 'Expand VM group' : 'Collapse VM group'"
                    (mousedown)="$event.stopPropagation()"
                    (click)="toggleVmCollapsed(bound.id); $event.stopPropagation()"
                  >
                    {{ bound.collapsed ? '+' : '-' }}
                  </button>
                </div>
              </div>
            }

            <!-- Route table route sub-containers -->
            @for (bound of routeTableBounds; track bound.id) {
              <div
                class="absolute rounded-lg border border-dashed border-cyan-300 bg-cyan-50/35 pointer-events-none"
                [style.left.px]="bound.x"
                [style.top.px]="bound.y"
                [style.width.px]="bound.width"
                [style.height.px]="bound.height"
              >
                <div
                  class="absolute top-0 left-0 right-0 flex items-center gap-2 px-2 py-1 text-[10px] font-semibold text-cyan-700 bg-cyan-100/70 rounded-t-lg select-none pointer-events-auto"
                  [class.cursor-crosshair]="activeTool !== 'pointer'"
                  style="z-index: 25; height: 24px"
                >
                  <span class="truncate">Routes: {{ bound.name }}</span>
                  <button
                    type="button"
                    class="ml-auto w-4 h-4 rounded text-cyan-700 hover:bg-cyan-200/70 transition-colors"
                    [title]="bound.collapsed ? 'Expand routes' : 'Collapse routes'"
                    (mousedown)="$event.stopPropagation()"
                    (click)="toggleRouteTableCollapsed(bound.id); $event.stopPropagation()"
                  >
                    {{ bound.collapsed ? '+' : '-' }}
                  </button>
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
                  (contextMenuRequested)="onContextMenuRequested($event)"
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
              @for (edge of visibleEdges; track edge.id) {
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

        </div>

        <!-- Sticky zoom controls (outside scroll container) -->
        <div
          class="absolute bottom-4 z-[130] flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-gray-200 bg-white/95 backdrop-blur shadow"
          [style.right.px]="store.sidebarOpen() ? 336 : 16"
        >
          <button
            class="w-7 h-7 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Zoom out"
            (click)="zoomOut()"
          >-</button>
          <button
            class="px-2 h-7 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
            title="Reset zoom"
            (click)="resetZoom()"
          >{{ zoomPercent }}%</button>
          <button
            class="w-7 h-7 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Zoom in"
            (click)="zoomIn()"
          >+</button>
        </div>

        @if (store.finOpsLayerActive()) {
          <aside
            class="absolute top-16 z-[130] w-[320px] rounded-xl border border-amber-200 bg-white/95 backdrop-blur shadow-lg p-3"
            [style.right.px]="store.sidebarOpen() ? 336 : 16"
          >
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-900">FinOps Insights</h3>
              @if (finOpsLoading) {
                <span class="text-[11px] text-amber-700">Loading...</span>
              }
            </div>

            @if (finOpsError) {
              <p class="text-xs text-red-600 leading-relaxed">{{ finOpsError }}</p>
            } @else {
              <div class="grid grid-cols-3 gap-2 mb-3">
                <div class="rounded-lg bg-amber-50 border border-amber-100 p-2">
                  <p class="text-[10px] text-amber-700">Total</p>
                  <p class="text-xs font-semibold text-amber-900">{{ formatUsd(store.totalMonthlyCost()) }}</p>
                </div>
                <div class="rounded-lg bg-blue-50 border border-blue-100 p-2">
                  <p class="text-[10px] text-blue-700">Costed</p>
                  <p class="text-xs font-semibold text-blue-900">{{ finOpsCostedNodeCount }}</p>
                </div>
                <div class="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                  <p class="text-[10px] text-emerald-700">Subs</p>
                  <p class="text-xs font-semibold text-emerald-900">{{ finOpsLoadedSubscriptions }}</p>
                </div>
              </div>

              <div>
                <p class="text-[11px] font-semibold text-gray-700 mb-1">Top Resources</p>
                @if (finOpsTopNodes.length === 0) {
                  <p class="text-xs text-gray-500">No matched cost data yet.</p>
                } @else {
                  <ul class="space-y-1">
                    @for (n of finOpsTopNodes; track n.id) {
                      <li class="flex items-start justify-between gap-2 text-xs">
                        <span class="text-gray-700 truncate" [title]="n.label">{{ n.label }}</span>
                        <span class="text-gray-900 font-medium whitespace-nowrap">{{ formatUsd(n.cost) }}</span>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </aside>
        }

        @if (store.sidebarOpen()) {
          <app-sidebar />
        }
      </div>

      <!-- Context menu (fixed, outside canvas zoom transform) -->
      @if (contextMenu) {
        <div class="fixed inset-0 z-[190]" (click)="closeContextMenu()" (contextmenu)="$event.preventDefault(); closeContextMenu()"></div>
        <div
          class="fixed z-[191] w-52 rounded-lg bg-white border border-gray-200 shadow-xl py-1 select-none"
          [style.left.px]="contextMenu.x"
          [style.top.px]="contextMenu.y"
          (click)="$event.stopPropagation()"
        >
          <!-- Resource label -->
          <div class="px-3 py-1.5 border-b border-gray-100">
            <p class="text-[11px] font-semibold text-gray-800 truncate" [title]="contextMenu.node.label">{{ contextMenu.node.label }}</p>
            <p class="text-[10px] text-gray-400 truncate">{{ contextMenu.node.resourceType.split('/').pop() }}</p>
          </div>

          <!-- Actions -->
          <div class="py-0.5">
            <button type="button" class="ctx-item" (click)="ctxFocus()">
              <svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="6"/>
                <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>
              </svg>
              Focus in sidebar
            </button>
            <button type="button" class="ctx-item" (click)="ctxTogglePin()">
              <svg class="ctx-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.5 1.5a1 1 0 0 1 1 1v.5h.5a1 1 0 0 1 .707 1.707L10.5 5.914V9.5a.5.5 0 0 1-.146.354L9 11.207V14.5a.5.5 0 0 1-.854.354L5.5 12.207V11.5l-1.354-.646A.5.5 0 0 1 3.5 10.5V9.914l-1.207-1.207A1 1 0 0 1 3 7h.5V2.5a1 1 0 0 1 1-1h5Z"/>
              </svg>
              {{ contextMenu.node.isPinned ? 'Unpin' : 'Pin' }}
            </button>
            <button type="button" class="ctx-item" (click)="ctxCopyName()">
              <svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="5" y="5" width="9" height="9" rx="1.5"/>
                <path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/>
              </svg>
              Copy name
            </button>
            <button type="button" class="ctx-item" (click)="ctxCopyResourceId()">
              <svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2"/>
                <path d="M10 4h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
                <line x1="5" y1="8" x2="11" y2="8"/>
              </svg>
              Copy resource ID
            </button>
          </div>

          <!-- Destructive -->
          <div class="border-t border-gray-100 py-0.5">
            <button type="button" class="ctx-item text-red-600 hover:bg-red-50" (click)="ctxDelete()">
              <svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
              </svg>
              Delete from diagram
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .ctx-item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      line-height: 1rem;
      color: #374151;
      text-align: left;
      transition: background-color 150ms ease, color 150ms ease;
    }
    .ctx-item:hover {
      background-color: #f9fafb;
    }
    .ctx-icon {
      width: 0.875rem;
      height: 0.875rem;
      flex-shrink: 0;
      color: #6b7280;
    }
  `],
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

  // Floating toolbar drag
  toolbarPos = { x: 12, y: 12 };
  toolbarDragState: { lastX: number; lastY: number } | null = null;

  // Node HTML5 drag
  private dragOffset = { x: 0, y: 0 };
  finOpsLoading = false;
  finOpsError: string | null = null;
  finOpsLoadedSubscriptions = 0;

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedAnnotationId) {
      this.deleteSelectedAnnotation();
    }
    if (e.key === 'Escape') {
      this.closeContextMenu();
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
      this.store.updateAnnotation(this.annDragId, {
        x: this.annDragOrigin.x + dx,
        y: this.annDragOrigin.y + dy,
        x2: this.annDragOrigin.x2 ? this.annDragOrigin.x2 + dx : undefined,
        y2: this.annDragOrigin.y2 ? this.annDragOrigin.y2 + dy : undefined,
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
      const { subscriptionId, name, nodes: rgNodes } = entry;
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

      return {
        id: subscriptionId || '__unknown-subscription__',
        subscriptionId,
        name: nameBySubscriptionId.get(subscriptionId) || subscriptionId || 'Unknown subscription',
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        collapsed,
        width: collapsed ? Math.max(320, Math.ceil((nameBySubscriptionId.get(subscriptionId) || subscriptionId || 'Unknown subscription').length * 7.5) + 96) : xMax - xMin + PAD * 2,
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

      bounds.push({
        id: vm.id,
        name: vm.label,
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
      const tableBottom = routeTable.position.y + routeTable.size.height;
      const yStart = tableBottom + GAP_BELOW_PARENT;
      const childBottom = Math.max(yStart, ...routeNodes.map(n => n.position.y + n.size.height));

      const xMin = Math.min(routeTable.position.x, ...routeNodes.map(n => n.position.x));
      const xMax = Math.max(routeTable.position.x + routeTable.size.width, ...routeNodes.map(n => n.position.x + n.size.width));

      bounds.push({
        id: routeTable.id,
        name: routeTable.label,
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
  getEdgeX1(nodeId: string): number { const n = this.store.nodes().find(n => n.id === nodeId); return n ? n.position.x + n.size.width / 2 : 0; }
  getEdgeY1(nodeId: string): number { const n = this.store.nodes().find(n => n.id === nodeId); return n ? n.position.y + n.size.height / 2 : 0; }
  getEdgeX2 = this.getEdgeX1.bind(this);
  getEdgeY2 = this.getEdgeY1.bind(this);

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
      const responses = await firstValueFrom(
        forkJoin(subIds.map(subscriptionId => this.costSvc.getSubscriptionCosts(subscriptionId)))
      );
      const summaries = responses.filter((r): r is NonNullable<typeof r> => r !== null);
      this.finOpsLoadedSubscriptions = summaries.length;

      let nextNodes: DiagramNode[] = this.store.nodes().map(n => ({ ...n, costData: undefined }));
      for (const summary of summaries) {
        nextNodes = this.costSvc.enrichNodesWithCosts(nextNodes, summary);
      }
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

interface RgBound {
  id: string;
  subscriptionId: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SubscriptionBound {
  id: string;
  subscriptionId: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VmBound {
  id: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RouteTableBound {
  id: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}
