import { Component, Input, Output, EventEmitter, HostListener, OnInit, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DrawingTool, StrokeStyle, EdgeRouting, EdgeMode } from '../../../core/models/annotation.model';
import { HighlightRuleType, TagRule, TagRuleOperator } from '../canvas.types';
import { IconRegistryService } from '../../../core/services/icon-registry.service';
import { ActionIconComponent } from '../../../shared/components/action-icon/action-icon.component';
import { ActionIconName } from '../../../shared/icons/action-icons';

interface Tool {
  id: DrawingTool;
  label: string;
  key: string;
  icon: ActionIconName;
  svgIcon?: string;
  category: 'select' | 'draw' | 'shape' | 'annotate' | 'container';
}

type TabId = 'tools' | 'style' | 'actions' | 'highlight' | 'azure';

interface ResourceCatalogEntry {
  type: string;
  label: string;
  iconUrl: string;
  category: string;
  source: 'curated' | 'manifest' | 'discovered';
}

const AZURE_RESOURCE_DND_TYPE = 'application/x-zuremap-azure-resource';

const TOOLS: Tool[] = [
  { id: 'pointer',  label: 'Select',    key: 'V', icon: 'pointer',   category: 'select' },
  { id: 'hand',     label: 'Hand',      key: 'H', icon: 'hand',      category: 'select' },
  { id: 'eraser',   label: 'Eraser',    key: 'X', icon: 'eraser',    category: 'select' },
  { id: 'draw',     label: 'Pen',       key: 'P', icon: 'penNib',    category: 'draw' },
  { id: 'line',     label: 'Line',      key: 'L', icon: 'line',      category: 'draw' },
  { id: 'arrow',    label: 'Arrow',     key: 'A', icon: 'arrowRight', category: 'draw' },
  { id: 'rect',     label: 'Rectangle', key: 'R', icon: 'rectangle', category: 'shape' },
  { id: 'ellipse',  label: 'Ellipse',   key: 'E', icon: 'ellipse',   category: 'shape' },
  { id: 'diamond',  label: 'Diamond',   key: 'D', icon: 'diamond',   category: 'shape' },
  { id: 'rgContainer',           label: 'RG Container',  key: 'G', icon: 'layers',    svgIcon: 'M2 4 L18 4 L18 17 L2 17 Z M2 8 L18 8',  category: 'container' },
  { id: 'subscriptionContainer', label: 'Sub Container', key: 'U', icon: 'layers',    svgIcon: 'M2 3 L18 3 L18 17 L2 17 Z M2 7 L18 7',  category: 'container' },
  { id: 'text',     label: 'Text',      key: 'T', icon: 'text',      category: 'annotate' },
  { id: 'sticky',   label: 'Note',      key: 'S', icon: 'sticky',    category: 'annotate' },
];

const COLORS = [
  '#1e1e1e', '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

const WIDTHS = [1, 2, 4, 6, 8];
const ERASER_WIDTHS = [8, 12, 16, 24, 32];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32];
const STROKE_STYLES: StrokeStyle[] = ['solid', 'dashed', 'dotted'];
const EDGE_ROUTINGS: EdgeRouting[] = ['straight', 'elbow'];
const EDGE_MODES: EdgeMode[] = ['none', 'start', 'end', 'both'];
const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
];

@Component({
  selector: 'app-drawing-toolbar',
  standalone: true,
  imports: [FormsModule, ActionIconComponent],
  template: `
    <div class="pointer-events-none absolute left-0 right-0 top-3 z-[165] select-none">
      <div class="pointer-events-auto mx-auto flex w-max items-center gap-1 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur">
        @for (tool of tools; track tool.id) {
          <button
            class="h-9 w-9 rounded-lg transition-colors flex items-center justify-center"
            [class.bg-blue-500]="activeTool === tool.id"
            [class.text-white]="activeTool === tool.id"
            [class.text-gray-600]="activeTool !== tool.id"
            [class.hover:bg-gray-100]="activeTool !== tool.id"
            [title]="tool.label + ' (' + tool.key + ')'"
            (click)="toolChange.emit(tool.id)"
          >
            @if (tool.svgIcon) {
              <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path [attr.d]="tool.svgIcon" />
              </svg>
            } @else {
              <app-action-icon [icon]="tool.icon" iconClass="w-4 h-4" />
            }
          </button>
        }
        <div class="mx-1 h-6 w-px bg-gray-200"></div>
        <button class="h-9 w-9 rounded-lg text-gray-600 hover:bg-gray-100" title="Undo (Ctrl+Z)" (click)="undo.emit()">
          <app-action-icon icon="undo" iconClass="w-4 h-4" />
        </button>
      </div>

      @if (showStylePanel) {
        <div
          class="pointer-events-auto absolute w-[360px] max-w-[92vw]"
          [style.left.px]="stylePanelPos.x"
          [style.top.px]="stylePanelPos.y"
        >
          @if (stylePanelCollapsed) {
            <button
              type="button"
              class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white/95 text-gray-700 shadow-md backdrop-blur hover:bg-white"
              (click)="stylePanelCollapsed = false"
              title="Show style panel"
              aria-label="Show style panel"
            >
              <app-action-icon icon="brush" iconClass="w-4 h-4" />
            </button>
          } @else {
            <div class="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
              <div
                class="mb-2 flex items-center justify-between cursor-grab"
                [class.cursor-grabbing]="stylePanelDragState !== null"
                (mousedown)="onStylePanelDragStart($event)"
              >
                <p class="text-xs font-semibold text-gray-700">Style</p>
                <button
                  type="button"
                  class="rounded-md px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                  (click)="stylePanelCollapsed = true"
                >
                  Collapse
                </button>
              </div>
              <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              @if (!isEraserTool()) {
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Color</p>
                  <input
                    type="color"
                    class="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    [value]="activeColor"
                    (input)="onCustomColor($event)"
                    title="Custom color"
                  />
                </div>
                <div class="flex flex-wrap gap-1.5">
                  @for (c of colors; track c) {
                    <button
                      class="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                      [style.background-color]="c"
                      [class.border-blue-400]="activeColor === c"
                      [class.ring-2]="activeColor === c"
                      [class.ring-blue-200]="activeColor === c"
                      [class.border-transparent]="activeColor !== c"
                      [title]="c"
                      (click)="colorChange.emit(c)"
                    ></button>
                  }
                </div>
              </div>
              }

              <!-- Font (text/sticky) -->
              @if (isTextTool()) {
                <div>
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Font</p>
                  <select
                    class="w-full h-9 rounded-lg border-2 border-gray-100 hover:border-gray-200 px-2 text-xs bg-white text-gray-700"
                    [value]="activeFontFamily"
                    (change)="fontFamilyChange.emit(stringValue($event))"
                  >
                    @for (font of fontFamilies; track font.value) {
                      <option [value]="font.value">{{ font.label }}</option>
                    }
                  </select>
                  <div class="mt-2">
                    <select
                      class="w-full h-9 rounded-lg border-2 border-gray-100 hover:border-gray-200 px-2 text-xs bg-white text-gray-700"
                      [value]="activeFontSize"
                      (change)="fontSizeChange.emit(toNumber($event))"
                    >
                      @for (size of fontSizes; track size) {
                        <option [value]="size">{{ size }} px</option>
                      }
                    </select>
                  </div>
                </div>
              }

              <!-- Stroke Width - Visual Preview -->
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{{ widthLabel() }}</p>
                @if (isEraserTool()) {
                  <div class="space-y-2">
                    <input
                      type="range"
                      [min]="eraserWidths[0]"
                      [max]="eraserWidths[eraserWidths.length - 1]"
                      step="1"
                      class="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer"
                      [value]="activeEraserWidth"
                      (input)="eraserWidthChange.emit(toNumber($event))"
                      title="Eraser width"
                    />
                    <div class="flex items-center justify-between">
                      <span class="text-[9px] text-gray-400">{{ eraserWidths[0] }}px</span>
                      <span class="text-[10px] font-medium text-gray-600">{{ activeEraserWidth }}px</span>
                      <span class="text-[9px] text-gray-400">{{ eraserWidths[eraserWidths.length - 1] }}px</span>
                    </div>
                  </div>
                } @else {
                  <div class="flex gap-1.5">
                    @for (w of widths; track w) {
                      <button
                        class="flex-1 h-10 rounded-lg border-2 flex items-center justify-center transition-all"
                        [class.border-blue-400]="activeStrokeWidth === w"
                        [class.bg-blue-50]="activeStrokeWidth === w"
                        [class.border-gray-100]="activeStrokeWidth !== w"
                        [class.hover:border-gray-200]="activeStrokeWidth !== w"
                        [title]="w + 'px'"
                        (click)="strokeWidthChange.emit(w)"
                      >
                        <div class="rounded-full bg-gray-700" [style.width.px]="w * 2 + 4" [style.height.px]="w * 2 + 4"></div>
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- Line Style - Visual Preview -->
              @if (!isEraserTool()) {
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Line Style</p>
                <div class="flex gap-1.5">
                  @for (s of strokeStyles; track s) {
                    <button
                      class="flex-1 h-10 rounded-lg border-2 flex items-center justify-center transition-all"
                      [class.border-blue-400]="activeStrokeStyle === s"
                      [class.bg-blue-50]="activeStrokeStyle === s"
                      [class.border-gray-100]="activeStrokeStyle !== s"
                      [class.hover:border-gray-200]="activeStrokeStyle !== s"
                      [title]="s"
                      (click)="strokeStyleChange.emit(s)"
                    >
                      <svg viewBox="0 0 40 10" class="w-8 h-2.5">
                        <line x1="2" y1="5" x2="38" y2="5" stroke="#374151" stroke-width="2" [attr.stroke-dasharray]="getStrokeDashPreview(s)" />
                      </svg>
                    </button>
                  }
                </div>
              </div>
              }

              <!-- Fill (only for shapes) -->
              @if (isShapeTool()) {
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fill</p>
                    <button
                      class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors"
                      [class.bg-blue-100]="activeFill !== 'none'"
                      [class.text-blue-600]="activeFill !== 'none'"
                      [class.bg-gray-100]="activeFill === 'none'"
                      [class.text-gray-500]="activeFill === 'none'"
                      (click)="fillChange.emit(activeFill === 'none' ? activeColor : 'none')"
                    >{{ activeFill === 'none' ? 'Off' : 'On' }}</button>
                  </div>
                  @if (activeFill !== 'none') {
                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <input
                        type="color"
                        class="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                        [value]="activeFill !== 'none' ? activeFill : activeColor"
                        (input)="fillChange.emit(colorValue($event))"
                        title="Fill color"
                      />
                      <div class="flex-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          class="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer"
                          [value]="activeFillOpacity"
                          (input)="fillOpacityChange.emit(toFloat($event))"
                          title="Opacity"
                        />
                      </div>
                      <span class="text-[10px] text-gray-500 w-7 text-right">{{ (activeFillOpacity * 100).toFixed(0) }}%</span>
                    </div>
                  }
                </div>
              }

              <!-- Line Options (only for line/arrow tools) -->
              @if (isLineTool()) {
                <div>
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Line Path</p>
                  <div class="flex gap-1.5">
                    @for (r of edgeRoutings; track r) {
                      <button
                        class="flex-1 h-10 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all"
                        [class.border-blue-400]="activeEdgeRouting === r"
                        [class.bg-blue-50]="activeEdgeRouting === r"
                        [class.border-gray-100]="activeEdgeRouting !== r"
                        [class.hover:border-gray-200]="activeEdgeRouting !== r"
                        (click)="edgeRoutingChange.emit(r)"
                      >
                        <svg viewBox="0 0 24 16" class="w-6 h-4" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round">
                          @if (r === 'straight') {
                            <line x1="2" y1="14" x2="22" y2="2" />
                          } @else {
                            <path d="M2 14 L2 8 L22 8 L22 2" />
                          }
                        </svg>
                        <span class="text-[9px] text-gray-500 capitalize">{{ r }}</span>
                      </button>
                    }
                  </div>
                </div>

                <div>
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Arrowheads</p>
                  <div class="grid grid-cols-4 gap-1.5">
                    @for (m of edgeModes; track m) {
                      <button
                        class="h-10 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all"
                        [class.border-blue-400]="activeEdgeMode === m"
                        [class.bg-blue-50]="activeEdgeMode === m"
                        [class.border-gray-100]="activeEdgeMode !== m"
                        [class.hover:border-gray-200]="activeEdgeMode !== m"
                        (click)="edgeModeChange.emit(m)"
                      >
                        <svg viewBox="0 0 32 12" class="w-7 h-3" fill="none" stroke="#374151" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="4" y1="6" x2="28" y2="6" />
                          @if (m === 'start' || m === 'both') {
                            <path d="M4 6 L8 3 M4 6 L8 9" />
                          }
                          @if (m === 'end' || m === 'both') {
                            <path d="M28 6 L24 3 M28 6 L24 9" />
                          }
                        </svg>
                        <span class="text-[9px] text-gray-500 capitalize">{{ m }}</span>
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Hand-drawn Effect -->
              @if (!isEraserTool()) {
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hand-drawn Effect</p>
                  <span class="text-[10px] text-gray-400">{{ getSloppinessLabel() }}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  class="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer"
                  [value]="activeSloppiness"
                  (input)="sloppinessChange.emit(toNumber($event))"
                />
                <div class="flex justify-between mt-1">
                  <span class="text-[9px] text-gray-400">Clean</span>
                  <span class="text-[9px] text-gray-400">Sketchy</span>
                </div>
              </div>
              }
            </div>
            </div>
          }
        </div>
      }

      <div class="pointer-events-auto absolute right-2 top-3">
        <button
          type="button"
          class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white/95 text-gray-700 shadow-md backdrop-blur transition-colors hover:bg-white"
          (click)="toggleSecondaryDrawer()"
          title="Open tools panel"
          aria-label="Open tools panel"
        >
          <app-action-icon icon="layers" iconClass="w-4 h-4" />
        </button>
        @if (secondaryDrawerOpen) {
        <div
          class="absolute right-0 top-11 w-[420px] max-w-[94vw] rounded-l-xl border border-r-0 border-gray-200 bg-white p-3 shadow-xl animate-[fadeIn_150ms_ease-out]"
        >
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-semibold text-gray-700">Canvas Tools</p>
              <button
                type="button"
                class="rounded-md px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                (click)="secondaryDrawerOpen = false"
              >
                Collapse
              </button>
            </div>
            <div class="grid grid-cols-[120px_1fr] gap-3">
              <div class="rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  class="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium transition-colors"
                  [class.bg-white]="activeTab==='actions'"
                  [class.text-blue-700]="activeTab==='actions'"
                  [class.text-gray-600]="activeTab!=='actions'"
                  (click)="activeTab='actions'"
                >
                  <app-action-icon icon="layout" iconClass="w-3.5 h-3.5" />
                  Actions
                </button>
                <button
                  class="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium transition-colors"
                  [class.bg-white]="activeTab==='highlight'"
                  [class.text-blue-700]="activeTab==='highlight'"
                  [class.text-gray-600]="activeTab!=='highlight'"
                  (click)="activeTab='highlight'"
                >
                  <app-action-icon icon="tags" iconClass="w-3.5 h-3.5" />
                  Highlight
                </button>
                <button
                  class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium transition-colors"
                  [class.bg-white]="activeTab==='azure'"
                  [class.text-blue-700]="activeTab==='azure'"
                  [class.text-gray-600]="activeTab!=='azure'"
                  (click)="activeTab='azure'"
                >
                  <app-action-icon icon="plus" iconClass="w-3.5 h-3.5" />
                  Azure
                </button>
              </div>
              <div class="rounded-lg border border-gray-200 bg-white p-2 max-h-[70vh] overflow-y-auto">
          @if (activeTab === 'highlight') {
            <div class="space-y-3">
              <!-- New rule builder (collapsed when a rule is being edited) -->
              @if (!editDraft) {
                <div class="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-2">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">New Rule</p>

                  <select
                    class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                    [(ngModel)]="draftRuleType"
                  >
                    <option value="tag">Tag Highlight Rule</option>
                    <option value="internal-item">Internal Label Style Rule</option>
                  </select>

                  @if (draftRuleType === 'tag') {
                  <div class="flex gap-1.5">
                    <input
                      type="text"
                      list="tag-keys-list"
                      class="flex-1 min-w-0 text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
                      placeholder="Tag key"
                      [(ngModel)]="draftKey"
                    />
                    <datalist id="tag-keys-list">
                      @for (k of tagKeyOptions; track k) {
                        <option [value]="k"></option>
                      }
                    </datalist>
                    <select
                      class="text-xs border border-gray-200 rounded-md px-1.5 py-1.5 outline-none focus:border-blue-400 bg-white"
                      [(ngModel)]="draftOperator"
                    >
                      <option value="eq">=</option>
                      <option value="neq">≠</option>
                      <option value="contains">contains</option>
                      <option value="exists">exists</option>
                      <option value="notexists">not exists</option>
                    </select>
                  </div>

                  @if (draftOperator !== 'exists' && draftOperator !== 'notexists') {
                    <input
                      type="text"
                      list="tag-values-list"
                      class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
                      placeholder="Tag value"
                      [(ngModel)]="draftValue"
                    />
                    <datalist id="tag-values-list">
                      @for (v of tagValueOptions; track v) {
                        <option [value]="v"></option>
                      }
                    </datalist>
                  }

                  <input
                    type="text"
                    class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
                    placeholder="Badge label (optional)"
                    [(ngModel)]="draftBadge"
                  />
                  } @else {
                    <input
                      type="text"
                      class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
                      placeholder="Label text contains (optional). Empty = all labels"
                      [(ngModel)]="draftInternalQuery"
                    />
                  }

                  <div class="flex items-center gap-2">
                    @if (draftRuleType === 'tag') {
                      <div class="flex rounded-md border border-gray-200 overflow-hidden text-[10px] font-medium">
                        @for (t of ruleTargets; track t.id) {
                          <button
                            class="px-2 py-1.5 transition-colors"
                            [class.bg-blue-500]="draftTarget === t.id"
                            [class.text-white]="draftTarget === t.id"
                            [class.bg-white]="draftTarget !== t.id"
                            [class.text-gray-600]="draftTarget !== t.id"
                            [class.hover:bg-gray-50]="draftTarget !== t.id"
                            (click)="draftTarget = t.id"
                          >{{ t.label }}</button>
                        }
                      </div>
                    }
                    <div class="flex items-center gap-1.5 ml-auto">
                      @if (draftRuleType === 'tag') {
                        <input
                          type="color"
                          class="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                          [(ngModel)]="draftColor"
                          title="Highlight color"
                        />
                      } @else {
                        <input
                          type="color"
                          class="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                          [(ngModel)]="draftInternalTextColor"
                          title="Internal label text color"
                        />
                        <input
                          type="color"
                          class="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                          [(ngModel)]="draftInternalBackgroundColor"
                          title="Internal label background color"
                        />
                      }
                      <button
                        class="px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-colors"
                        [class.bg-blue-500]="draftRuleType === 'internal-item' || draftKey.trim()"
                        [class.text-white]="draftRuleType === 'internal-item' || draftKey.trim()"
                        [class.hover:bg-blue-600]="draftRuleType === 'internal-item' || draftKey.trim()"
                        [class.bg-gray-100]="draftRuleType === 'tag' && !draftKey.trim()"
                        [class.text-gray-400]="draftRuleType === 'tag' && !draftKey.trim()"
                        [disabled]="draftRuleType === 'tag' && !draftKey.trim()"
                        (click)="addRule()"
                      >Add</button>
                    </div>
                  </div>
                </div>
              }

              <!-- Active rules list -->
              @if (tagRules.length === 0 && !editDraft) {
                <p class="text-[11px] text-gray-400 text-center py-3">No rules yet. Add one above.</p>
              } @else {
                <div class="space-y-1.5">
                  @if (!editDraft) {
                    <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Active Rules ({{ tagRules.length }})</p>
                  }
                  @for (rule of tagRules; track rule.id; let idx = $index) {

                    @if (editDraft?.id === rule.id) {
                      <!-- ── Inline edit form ── -->
                      <div class="rounded-lg border-2 p-2.5 space-y-2" [style.border-color]="ruleSwatchColor(editDraft!)" [style.background-color]="ruleSwatchColor(editDraft!) + '11'">
                        <div class="flex items-center justify-between">
                          <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Edit Rule</p>
                          <button class="text-[10px] text-gray-400 hover:text-gray-600" (click)="cancelEdit()">Cancel</button>
                        </div>

                        @if (editDraft!.type === 'tag') {
                        <div class="flex gap-1.5">
                          <input
                            type="text"
                            list="edit-tag-keys-list"
                            class="flex-1 min-w-0 text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                            placeholder="Tag key"
                            [ngModel]="editDraft!.tagKey"
                            (ngModelChange)="patchDraft('tagKey', $event)"
                          />
                          <datalist id="edit-tag-keys-list">
                            @for (k of tagKeyOptions; track k) {
                              <option [value]="k"></option>
                            }
                          </datalist>
                          <select
                            class="text-xs border border-gray-200 rounded-md px-1.5 py-1.5 outline-none focus:border-blue-400 bg-white"
                            [ngModel]="editDraft!.operator"
                            (ngModelChange)="patchDraft('operator', $event)"
                          >
                            <option value="eq">=</option>
                            <option value="neq">≠</option>
                            <option value="contains">contains</option>
                            <option value="exists">exists</option>
                            <option value="notexists">not exists</option>
                          </select>
                        </div>

                        @if (editDraft!.operator !== 'exists' && editDraft!.operator !== 'notexists') {
                          <input
                            type="text"
                            list="edit-tag-values-list"
                            class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                            placeholder="Tag value"
                            [ngModel]="editDraft!.tagValue"
                            (ngModelChange)="patchDraft('tagValue', $event)"
                          />
                          <datalist id="edit-tag-values-list">
                            @for (v of editTagValueOptions; track v) {
                              <option [value]="v"></option>
                            }
                          </datalist>
                        }

                        <input
                          type="text"
                          class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                          placeholder="Badge label (optional)"
                          [ngModel]="editDraft!.badgeLabel ?? ''"
                          (ngModelChange)="patchDraftBadge($event)"
                        />

                        <div class="flex items-center gap-2">
                          <div class="flex rounded-md border border-gray-200 overflow-hidden text-[10px] font-medium">
                            @for (t of ruleTargets; track t.id) {
                              <button
                                class="px-2 py-1.5 transition-colors"
                                [class.bg-blue-500]="editDraft!.target === t.id"
                                [class.text-white]="editDraft!.target === t.id"
                                [class.bg-white]="editDraft!.target !== t.id"
                                [class.text-gray-600]="editDraft!.target !== t.id"
                                (click)="patchDraft('target', t.id)"
                              >{{ t.label }}</button>
                            }
                          </div>
                          <input
                            type="color"
                            class="w-7 h-7 p-0 border-0 rounded cursor-pointer ml-auto"
                            [ngModel]="editDraft!.color"
                            (ngModelChange)="patchDraft('color', $event)"
                            title="Highlight color"
                          />
                          <button
                            class="px-2.5 py-1.5 rounded-md text-[10px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            (click)="saveEdit()"
                          >Save</button>
                        </div>
                        } @else {
                        <input
                          type="text"
                          class="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                          placeholder="Label text contains (optional). Empty = all labels"
                          [ngModel]="editDraft!.textQuery ?? ''"
                          (ngModelChange)="patchDraft('textQuery', $event)"
                        />
                        <div class="flex items-center gap-2">
                          <input
                            type="color"
                            class="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                            [ngModel]="editDraft!.textColor ?? '#1d4ed8'"
                            (ngModelChange)="patchDraft('textColor', $event)"
                            title="Internal label text color"
                          />
                          <input
                            type="color"
                            class="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                            [ngModel]="editDraft!.backgroundColor ?? '#eff6ff'"
                            (ngModelChange)="patchDraft('backgroundColor', $event)"
                            title="Internal label background color"
                          />
                          <button
                            class="ml-auto px-2.5 py-1.5 rounded-md text-[10px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            (click)="saveEdit()"
                          >Save</button>
                        </div>
                        }
                      </div>

                    } @else {
                      <!-- ── Compact rule card ── -->
                      <div
                        class="group flex items-center gap-2 px-2.5 py-2 bg-white rounded-lg border transition-colors"
                        [class.border-gray-200]="editDraft?.id !== rule.id"
                        [class.opacity-40]="editDraft && editDraft.id !== rule.id"
                      >
                        <!-- Priority reorder -->
                        <div class="flex flex-col gap-0.5 flex-shrink-0">
                          <button
                            class="w-4 h-3.5 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors rounded"
                            title="Move up (higher priority)"
                            [disabled]="idx === 0"
                            (click)="moveRule(rule.id, -1)"
                          >
                            <app-action-icon icon="moveUp" iconClass="w-2.5 h-2" />
                          </button>
                          <button
                            class="w-4 h-3.5 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors rounded"
                            title="Move down (lower priority)"
                            [disabled]="idx === tagRules.length - 1"
                            (click)="moveRule(rule.id, 1)"
                          >
                            <app-action-icon icon="moveDown" iconClass="w-2.5 h-2" />
                          </button>
                        </div>

                        <!-- Color swatch -->
                        <span class="w-3 h-3 rounded-sm flex-shrink-0" [style.background-color]="ruleSwatchColor(rule)"></span>

                        <!-- Summary -->
                        <div class="flex-1 min-w-0">
                          <p class="text-[11px] font-medium text-gray-700 truncate">
                            {{ ruleSummary(rule) }}
                          </p>
                          <p class="text-[10px] text-gray-400 truncate">
                            {{ ruleTypeLabel(rule) }} · {{ ruleDetail(rule) }}
                          </p>
                        </div>

                        <!-- Actions (edit + delete) -->
                        <div class="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-blue-500 transition-colors rounded"
                            title="Edit rule"
                            (click)="beginEdit(rule)"
                          >
                            <app-action-icon icon="edit" iconClass="w-3.5 h-3.5" />
                          </button>
                          <button
                            class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors rounded"
                            title="Delete rule"
                            (click)="removeRule(rule.id)"
                          >
                            <app-action-icon icon="close" iconClass="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    }

                  }
                </div>
              }

            </div>
          }

          @if (activeTab === 'azure') {
            <div class="space-y-3">
              <!-- Search + Category filter -->
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <app-action-icon icon="search" iconClass="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    class="w-full text-xs border border-gray-200 rounded-lg pl-8 pr-2 py-1.5 outline-none focus:border-blue-400 transition"
                    placeholder="Search resources..."
                    [(ngModel)]="resourceSearch"
                  />
                </div>
                <select
                  class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-white transition max-w-[110px]"
                  [(ngModel)]="resourceCategoryFilter"
                >
                  <option value="">All</option>
                  @for (cat of resourceCategories; track cat) {
                    <option [value]="cat">{{ cat }}</option>
                  }
                </select>
              </div>

              <!-- Resource grid -->
              <div class="grid grid-cols-3 gap-1.5 max-h-[280px] overflow-y-auto pr-0.5">
                @for (entry of filteredResources; track entry.type) {
                  <button
                    draggable="true"
                    class="flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center"
                    [class.border-blue-400]="activeResourceType === entry.type"
                    [class.bg-blue-50]="activeResourceType === entry.type"
                    [class.shadow-sm]="activeResourceType === entry.type"
                    [class.border-gray-100]="activeResourceType !== entry.type"
                    [class.hover:border-gray-200]="activeResourceType !== entry.type"
                    [class.hover:bg-gray-50]="activeResourceType !== entry.type"
                    [title]="entry.label + ' (' + entry.type + ')'"
                    (dragstart)="onResourceDragStart($event, entry)"
                    (click)="selectResourceType(entry)"
                  >
                    <img [src]="entry.iconUrl" class="w-7 h-7 object-contain" alt="" />
                    <span class="text-[9px] leading-tight text-gray-600 line-clamp-2">{{ entry.label }}</span>
                  </button>
                }
                @if (filteredResources.length === 0) {
                  <p class="col-span-3 text-xs text-gray-400 text-center py-4">No resources match your search.</p>
                }
              </div>

              <!-- Placement hint -->
              @if (activeResourceType) {
                <div class="flex items-center gap-2 px-2.5 py-2 bg-blue-50 rounded-lg border border-blue-100">
                  <div class="w-6 h-6 rounded-md bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
                    <app-action-icon icon="crosshair" iconClass="w-3.5 h-3.5" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-blue-700 truncate">{{ selectedResourceLabel }}</p>
                    <p class="text-[10px] text-blue-500">Click canvas to place</p>
                  </div>
                </div>
              } @else {
                <div class="flex items-center gap-2 px-2.5 py-2 bg-gray-50 rounded-lg">
                  <div class="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center">
                    <app-action-icon icon="plus" iconClass="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p class="text-[10px] text-gray-400">Select a resource type above</p>
                </div>
              }
            </div>
          }

          @if (activeTab === 'actions') {
            <div class="space-y-3">
              <!-- Quick Actions -->
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</p>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="h-10 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                    (click)="undo.emit()"
                  >
                    <app-action-icon icon="undo" iconClass="w-4 h-4" />
                    Undo
                  </button>
                  <button
                    class="h-10 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                    (click)="toolChange.emit('pointer')"
                  >
                    <app-action-icon icon="focus" iconClass="w-4 h-4" />
                    Select
                  </button>
                </div>
              </div>

              <!-- Selection Actions -->
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Selection
                  @if (!hasSelection) {
                    <span class="font-normal normal-case text-gray-300 ml-1">(select an item first)</span>
                  }
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="h-10 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    [class.bg-blue-50]="hasSelection"
                    [class.border-blue-200]="hasSelection"
                    [class.text-blue-600]="hasSelection"
                    [class.hover:bg-blue-100]="hasSelection"
                    [class.bg-gray-50]="!hasSelection"
                    [class.border-gray-100]="!hasSelection"
                    [class.text-gray-300]="!hasSelection"
                    [disabled]="!hasSelection"
                    (click)="duplicateSelected.emit()"
                  >
                    <app-action-icon icon="duplicate" iconClass="w-4 h-4" />
                    Duplicate
                  </button>
                  <button
                    class="h-10 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    [class.bg-red-50]="hasSelection"
                    [class.border-red-200]="hasSelection"
                    [class.text-red-600]="hasSelection"
                    [class.hover:bg-red-100]="hasSelection"
                    [class.bg-gray-50]="!hasSelection"
                    [class.border-gray-100]="!hasSelection"
                    [class.text-gray-300]="!hasSelection"
                    [disabled]="!hasSelection"
                    (click)="deleteSelected.emit()"
                  >
                    <app-action-icon icon="delete" iconClass="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    class="h-10 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    [class.bg-gray-50]="hasSelection"
                    [class.border-gray-200]="hasSelection"
                    [class.text-gray-600]="hasSelection"
                    [class.hover:bg-gray-100]="hasSelection"
                    [class.border-gray-100]="!hasSelection"
                    [class.text-gray-300]="!hasSelection"
                    [disabled]="!hasSelection"
                    (click)="bringToFront.emit()"
                  >
                    <app-action-icon icon="bringFront" iconClass="w-4 h-4" />
                    Bring Front
                  </button>
                  <button
                    class="h-10 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    [class.bg-gray-50]="hasSelection"
                    [class.border-gray-200]="hasSelection"
                    [class.text-gray-600]="hasSelection"
                    [class.hover:bg-gray-100]="hasSelection"
                    [class.border-gray-100]="!hasSelection"
                    [class.text-gray-300]="!hasSelection"
                    [disabled]="!hasSelection"
                    (click)="sendToBack.emit()"
                  >
                    <app-action-icon icon="sendBack" iconClass="w-4 h-4" />
                    Send Back
                  </button>
                </div>
              </div>

              <!-- Danger Zone -->
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Clear Canvas</p>
                <button
                  class="w-full h-10 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  [class.bg-red-50]="annotationCount > 0"
                  [class.border-red-200]="annotationCount > 0"
                  [class.text-red-600]="annotationCount > 0"
                  [class.hover:bg-red-100]="annotationCount > 0"
                  [class.bg-gray-50]="annotationCount === 0"
                  [class.border-gray-100]="annotationCount === 0"
                  [class.text-gray-300]="annotationCount === 0"
                  [disabled]="annotationCount === 0"
                  (click)="clearAll.emit()"
                >
                  <app-action-icon icon="clear" iconClass="w-4 h-4" />
                  Clear All ({{ annotationCount }} item{{ annotationCount === 1 ? '' : 's' }})
                </button>
              </div>

              <!-- Keyboard Shortcuts -->
              <div class="p-2.5 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border border-gray-100">
                <p class="text-[10px] font-semibold text-gray-500 mb-1.5">Keyboard Shortcuts</p>
                <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div class="flex justify-between">
                    <span class="text-gray-400">Select</span>
                    <kbd class="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600 font-mono">V</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Line</span>
                    <kbd class="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600 font-mono">L</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Arrow</span>
                    <kbd class="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600 font-mono">A</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Rectangle</span>
                    <kbd class="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600 font-mono">R</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Duplicate</span>
                    <kbd class="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600 font-mono">Ctrl+D</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Delete</span>
                    <kbd class="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600 font-mono">Del</kbd>
                  </div>
                </div>
              </div>
            </div>
          }
              </div>
            </div>
        </div>
        }
      </div>
    </div>
  `,
})
export class DrawingToolbarComponent implements OnInit {
  private readonly iconRegistry = inject(IconRegistryService);

  @Input() activeTool: DrawingTool = 'pointer';
  @Input() activeColor = '#1e1e1e';
  @Input() activeFontFamily = 'Arial, sans-serif';
  @Input() activeFontSize = 14;
  @Input() activeStrokeWidth = 2;
  @Input() activeEraserWidth = 12;
  @Input() activeStrokeStyle: StrokeStyle = 'solid';
  @Input() activeSloppiness = 0;
  @Input() activeEdgeRouting: EdgeRouting = 'straight';
  @Input() activeEdgeMode: EdgeMode = 'end';
  @Input() activeFill = 'none';
  @Input() activeFillOpacity = 0.2;
  @Input() canEditTextStyle = false;
  @Input() canEditFillStyle = false;
  @Input() hasSelection = false;
  @Input() annotationCount = 0;
  @Input() tagRules: TagRule[] = [];
  @Input() availableTags = new Map<string, Set<string>>();
  @Input() activeResourceType = '';
  @Input() discoveredResourceTypes: string[] = [];

  @Output() tagRulesChange = new EventEmitter<TagRule[]>();

  @Output() toolChange = new EventEmitter<DrawingTool>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() fontFamilyChange = new EventEmitter<string>();
  @Output() fontSizeChange = new EventEmitter<number>();
  @Output() strokeWidthChange = new EventEmitter<number>();
  @Output() eraserWidthChange = new EventEmitter<number>();
  @Output() strokeStyleChange = new EventEmitter<StrokeStyle>();
  @Output() sloppinessChange = new EventEmitter<number>();
  @Output() edgeRoutingChange = new EventEmitter<EdgeRouting>();
  @Output() edgeModeChange = new EventEmitter<EdgeMode>();
  @Output() fillChange = new EventEmitter<string>();
  @Output() fillOpacityChange = new EventEmitter<number>();
  @Output() undo = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();
  @Output() deleteSelected = new EventEmitter<void>();
  @Output() duplicateSelected = new EventEmitter<void>();
  @Output() bringToFront = new EventEmitter<void>();
  @Output() sendToBack = new EventEmitter<void>();
  @Output() resourceTypeChange = new EventEmitter<string>();

  readonly tools = TOOLS;
  readonly colors = COLORS;
  readonly widths = WIDTHS;
  readonly eraserWidths = ERASER_WIDTHS;
  readonly fontSizes = FONT_SIZES;
  readonly strokeStyles = STROKE_STYLES;
  readonly edgeRoutings = EDGE_ROUTINGS;
  readonly edgeModes = EDGE_MODES;
  readonly fontFamilies = FONT_FAMILIES;

  readonly tabs: { id: TabId; label: string }[] = [
    { id: 'tools', label: 'Tools' },
    { id: 'style', label: 'Style' },
    { id: 'actions', label: 'Actions' },
    { id: 'highlight', label: 'Highlight' },
    { id: 'azure', label: 'Azure' },
  ];

  // Resource browser state
  resourceSearch = '';
  resourceCategoryFilter = '';
  resourceCatalog: ResourceCatalogEntry[] = [];
  resourceCategories: string[] = [];
  selectedResourceLabel = '';

  ngOnInit(): void {
    this.resourceCatalog = this.iconRegistry.getHybridResourceTypeCatalog(this.discoveredResourceTypes);
    const cats = [...new Set(this.resourceCatalog.map(e => e.category))].sort();
    this.resourceCategories = cats;
  }

  get filteredResources(): ResourceCatalogEntry[] {
    const search = this.resourceSearch.toLowerCase();
    return this.resourceCatalog.filter(e => {
      const matchesSearch = !search || e.label.toLowerCase().includes(search) || e.type.includes(search);
      const matchesCat = !this.resourceCategoryFilter || e.category === this.resourceCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }

  selectResourceType(entry: ResourceCatalogEntry): void {
    this.selectedResourceLabel = entry.label;
    this.resourceTypeChange.emit(entry.type);
    this.toolChange.emit('resource');
    this.activeTab = 'azure';
  }

  onResourceDragStart(event: DragEvent, entry: ResourceCatalogEntry): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(
      AZURE_RESOURCE_DND_TYPE,
      JSON.stringify({ type: entry.type, label: entry.label }),
    );
  }

  readonly ruleTargets: { id: TagRule['target']; label: string }[] = [
    { id: 'node', label: 'Node' },
    { id: 'rg', label: 'RG' },
    { id: 'sub', label: 'Sub' },
    { id: 'both', label: 'RG+Sub' },
  ];

  // Draft state for rule builder
  draftKey = '';
  draftRuleType: HighlightRuleType = 'tag';
  draftOperator: TagRuleOperator = 'eq';
  draftValue = '';
  draftColor = '#ef4444';
  draftTarget: TagRule['target'] = 'node';
  draftBadge = '';
  draftInternalQuery = '';
  draftInternalTextColor = '#1d4ed8';
  draftInternalBackgroundColor = '#eff6ff';

  get tagKeyOptions(): string[] {
    return Array.from(this.availableTags.keys()).sort();
  }

  get tagValueOptions(): string[] {
    if (!this.draftKey) return [];
    return Array.from(this.availableTags.get(this.draftKey) ?? []).sort();
  }

  addRule(): void {
    let rule: TagRule;
    if (this.draftRuleType === 'tag') {
      if (!this.draftKey.trim()) return;
      rule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'tag',
        tagKey: this.draftKey.trim(),
        operator: this.draftOperator,
        tagValue: this.draftValue.trim(),
        target: this.draftTarget,
        color: this.draftColor,
        badgeLabel: this.draftBadge.trim() || undefined,
      };
    } else {
      rule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'internal-item',
        textQuery: this.draftInternalQuery.trim(),
        textColor: this.draftInternalTextColor,
        backgroundColor: this.draftInternalBackgroundColor,
      };
    }
    this.tagRulesChange.emit([...this.tagRules, rule]);
    this.draftKey = '';
    this.draftValue = '';
    this.draftBadge = '';
    this.draftInternalQuery = '';
  }

  removeRule(id: string): void {
    this.tagRulesChange.emit(this.tagRules.filter(r => r.id !== id));
  }

  operatorLabel(op: TagRuleOperator): string {
    const map: Record<TagRuleOperator, string> = {
      eq: '=', neq: '≠', contains: 'contains', exists: 'exists', notexists: 'not exists',
    };
    return map[op];
  }

  editDraft: TagRule | null = null;

  get editTagValueOptions(): string[] {
    if (!this.editDraft?.tagKey) return [];
    return Array.from(this.availableTags.get(this.editDraft.tagKey) ?? []).sort();
  }

  targetLabel(target: NonNullable<TagRule['target']>): string {
    const map: Record<NonNullable<TagRule['target']>, string> = {
      node: 'Nodes', rg: 'Resource Groups', sub: 'Subscriptions', both: 'RG + Sub',
    };
    return map[target];
  }

  beginEdit(rule: TagRule): void {
    this.editDraft = { ...rule, type: rule.type ?? 'tag' };
  }

  saveEdit(): void {
    if (!this.editDraft) return;
    this.tagRulesChange.emit(this.tagRules.map(r => r.id === this.editDraft!.id ? this.editDraft! : r));
    this.editDraft = null;
  }

  cancelEdit(): void {
    this.editDraft = null;
  }

  patchDraft(field: keyof TagRule, value: unknown): void {
    if (!this.editDraft) return;
    this.editDraft = { ...this.editDraft, [field]: value } as TagRule;
  }

  patchDraftBadge(value: string): void {
    if (!this.editDraft) return;
    this.editDraft = { ...this.editDraft, badgeLabel: value || undefined };
  }

  moveRule(id: string, direction: -1 | 1): void {
    const idx = this.tagRules.findIndex(r => r.id === id);
    if (idx === -1) return;
    const next = [...this.tagRules];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    this.tagRulesChange.emit(next);
  }

  ruleTypeLabel(rule: TagRule): string {
    return rule.type === 'internal-item' ? 'Internal Labels' : 'Tag Highlight';
  }

  ruleSummary(rule: TagRule): string {
    if (rule.type === 'internal-item') {
      return rule.textQuery?.trim() ? `label contains "${rule.textQuery}"` : 'all internal labels';
    }
    const key = rule.tagKey ?? '';
    const op = this.operatorLabel(rule.operator ?? 'eq');
    const val = rule.tagValue?.trim();
    return `${key} ${op}${val ? ' ' + val : ''}`;
  }

  ruleDetail(rule: TagRule): string {
    if (rule.type === 'internal-item') {
      return `Text ${rule.textColor ?? '#1d4ed8'} · Bg ${rule.backgroundColor ?? '#eff6ff'}`;
    }
    return `${this.targetLabel(rule.target ?? 'node')}${rule.badgeLabel ? ' · "' + rule.badgeLabel + '"' : ''}`;
  }

  ruleSwatchColor(rule: TagRule): string {
    return rule.type === 'internal-item' ? (rule.backgroundColor ?? '#eff6ff') : (rule.color ?? '#ef4444');
  }

  readonly toolCategories = [
    { id: 'select' as const, label: 'Selection' },
    { id: 'draw' as const, label: 'Lines' },
    { id: 'shape' as const, label: 'Shapes' },
    { id: 'container' as const, label: 'Containers' },
    { id: 'annotate' as const, label: 'Annotations' },
  ];

  activeTab: TabId = 'tools';
  secondaryDrawerOpen = false;
  stylePanelCollapsed = false;
  stylePanelPos = { x: 12, y: 72 };
  stylePanelDragState: { lastX: number; lastY: number } | null = null;

  get showStylePanel(): boolean {
    return (
      (this.activeTool !== 'pointer' && this.activeTool !== 'hand' && this.activeTool !== 'eraser') ||
      this.activeTool === 'eraser' ||
      this.canEditTextStyle ||
      this.canEditFillStyle
    );
  }

  toggleSecondaryDrawer(): void {
    const opening = !this.secondaryDrawerOpen;
    this.secondaryDrawerOpen = opening;
    if (opening) this.activeTab = 'azure';
  }

  onStylePanelDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    this.stylePanelDragState = { lastX: event.clientX, lastY: event.clientY };
  }

  getToolsByCategory(category: Tool['category']): Tool[] {
    return this.tools.filter(t => t.category === category);
  }

  getActiveToolIcon(): string {
    if (this.activeTool === 'resource') return 'M3 3 L17 3 L17 17 L3 17 Z M7 10 L13 10 M10 7 L10 13';
    return this.tools.find(t => t.id === this.activeTool)?.icon || '';
  }

  getActiveToolLabel(): string {
    if (this.activeTool === 'resource') return this.selectedResourceLabel || 'Azure Resource';
    return this.tools.find(t => t.id === this.activeTool)?.label || 'Select';
  }

  getActiveToolHint(): string {
    const hints: Record<DrawingTool, string> = {
      pointer: 'Click to select, drag to move',
      hand: 'Drag canvas to pan',
      eraser: 'Drag to erase items with a fading trace',
      draw: 'Click and drag to draw freely',
      line: 'Click and drag to draw a line',
      arrow: 'Click and drag to draw an arrow',
      text: 'Click to place text',
      rect: 'Click and drag to draw a rectangle',
      ellipse: 'Click and drag to draw an ellipse',
      diamond: 'Click and drag to draw a diamond',
      sticky: 'Click to place a sticky note',
      rgContainer: 'Drag to draw a resource group container',
      subscriptionContainer: 'Drag to draw a subscription container',
      resource: `Click canvas to place${this.selectedResourceLabel ? ': ' + this.selectedResourceLabel : ''}`,
    };
    return hints[this.activeTool];
  }

  getSloppinessLabel(): string {
    const labels = ['Clean', 'Light', 'Medium', 'Sketchy'];
    return labels[this.activeSloppiness] || 'Clean';
  }

  getStrokeDashPreview(style: StrokeStyle): string {
    switch (style) {
      case 'dashed': return '6,4';
      case 'dotted': return '2,3';
      default: return '';
    }
  }

  isShapeTool(): boolean {
    return ['rect', 'ellipse', 'diamond'].includes(this.activeTool) || this.canEditFillStyle;
  }

  isEraserTool(): boolean {
    return this.activeTool === 'eraser';
  }

  isLineTool(): boolean {
    return ['line', 'arrow'].includes(this.activeTool);
  }

  isTextTool(): boolean {
    return this.activeTool === 'text' || this.activeTool === 'sticky' || this.canEditTextStyle;
  }

  onCustomColor(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.colorChange.emit(value);
  }

  currentWidthValue(): number {
    return this.isEraserTool() ? this.activeEraserWidth : this.activeStrokeWidth;
  }

  widthOptions(): number[] {
    return this.isEraserTool() ? this.eraserWidths : this.widths;
  }

  widthLabel(): string {
    if (this.isEraserTool()) return 'Eraser Width';
    return this.isLineTool() ? 'Arrow Width' : 'Stroke Width';
  }

  toNumber(event: Event): number {
    return Number((event.target as HTMLInputElement).value || 0);
  }

  toFloat(event: Event): number {
    return Number((event.target as HTMLInputElement).value || 0);
  }

  colorValue(event: Event): string {
    return (event.target as HTMLInputElement).value || this.activeColor;
  }

  stringValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value || '';
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
    const map: Record<string, DrawingTool> = {
      v: 'pointer',
      h: 'hand',
      x: 'eraser',
      p: 'draw',
      l: 'line',
      a: 'arrow',
      t: 'text',
      r: 'rect',
      e: 'ellipse',
      d: 'diamond',
      s: 'sticky',
      g: 'rgContainer',
      u: 'subscriptionContainer',
    };
    const tool = map[e.key.toLowerCase()];
    if (!hasModifier && tool) { e.preventDefault(); this.toolChange.emit(tool); }
    if (e.key === 'Escape') this.toolChange.emit('pointer');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.duplicateSelected.emit();
    }
    if (e.key === ']') {
      e.preventDefault();
      this.bringToFront.emit();
    }
    if (e.key === '[') {
      e.preventDefault();
      this.sendToBack.emit();
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.stylePanelDragState) return;
    const dx = event.clientX - this.stylePanelDragState.lastX;
    const dy = event.clientY - this.stylePanelDragState.lastY;
    this.stylePanelDragState = { lastX: event.clientX, lastY: event.clientY };
    const maxX = Math.max(8, window.innerWidth - 380);
    const maxY = Math.max(72, window.innerHeight - 120);
    this.stylePanelPos = {
      x: Math.max(8, Math.min(maxX, this.stylePanelPos.x + dx)),
      y: Math.max(72, Math.min(maxY, this.stylePanelPos.y + dy)),
    };
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.stylePanelDragState = null;
  }
}
