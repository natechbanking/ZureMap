import { Component, Input, Output, EventEmitter, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawingTool, StrokeStyle, EdgeRouting, EdgeMode } from '../../../core/models/annotation.model';
import { TagRule, TagRuleOperator } from '../canvas.types';
import { IconRegistryService } from '../../../core/services/icon-registry.service';

interface Tool {
  id: DrawingTool;
  label: string;
  key: string;
  icon: string;
  category: 'select' | 'draw' | 'shape' | 'annotate';
}

type TabId = 'tools' | 'style' | 'actions' | 'highlight' | 'azure';

interface ResourceCatalogEntry {
  type: string;
  label: string;
  iconUrl: string;
  category: string;
}

const AZURE_RESOURCE_DND_TYPE = 'application/x-zuremap-azure-resource';

const TOOLS: Tool[] = [
  { id: 'pointer',  label: 'Select',    key: 'V', icon: 'M4 2 L4 14 L7 11 L9 16 L11 15 L9 10 L13 10 Z', category: 'select' },
  { id: 'draw',     label: 'Pen',       key: 'P', icon: 'M14 2 L18 6 L7 17 L3 18 L4 14 Z M14 2 L18 6', category: 'draw' },
  { id: 'line',     label: 'Line',      key: 'L', icon: 'M3 15 L17 5', category: 'draw' },
  { id: 'arrow',    label: 'Arrow',     key: 'A', icon: 'M3 10 L17 10 M12 5 L17 10 L12 15', category: 'draw' },
  { id: 'rect',     label: 'Rectangle', key: 'R', icon: 'M3 4 L17 4 L17 16 L3 16 Z', category: 'shape' },
  { id: 'ellipse',  label: 'Ellipse',   key: 'E', icon: 'M10 4 A7 5 0 1 0 10 16 A7 5 0 1 0 10 4', category: 'shape' },
  { id: 'diamond',  label: 'Diamond',   key: 'D', icon: 'M10 2 L18 10 L10 18 L2 10 Z', category: 'shape' },
  { id: 'text',     label: 'Text',      key: 'T', icon: 'M3 5 L17 5 M10 5 L10 17 M7 17 L13 17', category: 'annotate' },
  { id: 'sticky',   label: 'Note',      key: 'S', icon: 'M3 3 L14 3 L17 6 L17 17 L3 17 Z M14 3 L14 6 L17 6', category: 'annotate' },
];

const COLORS = [
  '#1e1e1e', '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

const WIDTHS = [1, 2, 4, 6, 8];
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 select-none overflow-hidden transition-all"
      [style.width.px]="collapsed ? 52 : 280">

      <!-- Header -->
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2 L18 6 L7 17 L3 18 L4 14 Z" />
          </svg>
        </div>
        @if (!collapsed) {
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800">Drawing Tools</p>
          </div>
        }
        <button
          class="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all flex items-center justify-center"
          [title]="collapsed ? 'Expand' : 'Collapse'"
          (click)="collapsed = !collapsed"
        >
          <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path [attr.d]="collapsed ? 'M8 5 L13 10 L8 15' : 'M12 5 L7 10 L12 15'" />
          </svg>
        </button>
      </div>

      @if (collapsed) {
        <!-- Collapsed: Vertical tool strip -->
        <div class="p-1.5 flex flex-col gap-1">
          @for (tool of tools; track tool.id) {
            <button
              class="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              [class.bg-blue-500]="activeTool === tool.id"
              [class.text-white]="activeTool === tool.id"
              [class.shadow-sm]="activeTool === tool.id"
              [class.text-gray-500]="activeTool !== tool.id"
              [class.hover:bg-gray-100]="activeTool !== tool.id"
              [title]="tool.label + ' (' + tool.key + ')'"
              (click)="toolChange.emit(tool.id)"
            >
              <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path [attr.d]="tool.icon" />
              </svg>
            </button>
          }
          <div class="h-px bg-gray-200 my-1"></div>
          <button
            class="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            title="Undo (Ctrl+Z)"
            (click)="undo.emit()"
          >
            <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 10 A6 6 0 1 1 7 5" />
              <path d="M4 6 L4 10 L8 10" />
            </svg>
          </button>
        </div>
      } @else {
        <!-- Expanded: Full panel with tabs -->
        <div class="flex border-b border-gray-100">
          @for (tab of tabs; track tab.id) {
            <button
              class="flex-1 py-2 text-xs font-medium transition-colors relative"
              [class.text-blue-600]="activeTab === tab.id"
              [class.text-gray-500]="activeTab !== tab.id"
              [class.hover:text-gray-700]="activeTab !== tab.id"
              (click)="activeTab = tab.id"
            >
              {{ tab.label }}
              @if (activeTab === tab.id) {
                <div class="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full"></div>
              }
            </button>
          }
        </div>

        <div class="p-3">
          @if (activeTab === 'tools') {
            <!-- TOOLS TAB -->
            <div class="space-y-3">
              <!-- Tool Categories -->
              @for (category of toolCategories; track category.id) {
                <div>
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{{ category.label }}</p>
                  <div class="flex gap-1.5">
                    @for (tool of getToolsByCategory(category.id); track tool.id) {
                      <button
                        class="flex-1 h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all"
                        [class.border-blue-400]="activeTool === tool.id"
                        [class.bg-blue-50]="activeTool === tool.id"
                        [class.text-blue-600]="activeTool === tool.id"
                        [class.shadow-sm]="activeTool === tool.id"
                        [class.border-gray-100]="activeTool !== tool.id"
                        [class.text-gray-500]="activeTool !== tool.id"
                        [class.hover:border-gray-200]="activeTool !== tool.id"
                        [class.hover:bg-gray-50]="activeTool !== tool.id"
                        [title]="tool.label + ' (' + tool.key + ')'"
                        (click)="toolChange.emit(tool.id)"
                      >
                        <svg viewBox="0 0 20 20" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <path [attr.d]="tool.icon" />
                        </svg>
                        <span class="text-[10px] font-medium leading-none">{{ tool.label }}</span>
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Active Tool Hint -->
              <div class="flex items-center gap-2 px-2.5 py-2 bg-gray-50 rounded-lg">
                <div class="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path [attr.d]="getActiveToolIcon()" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-gray-700">{{ getActiveToolLabel() }}</p>
                  <p class="text-[10px] text-gray-400">{{ getActiveToolHint() }}</p>
                </div>
              </div>
            </div>
          }

          @if (activeTab === 'style') {
            <!-- STYLE TAB -->
            <div class="space-y-4">
              <!-- Color -->
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
                </div>
              }

              <!-- Stroke Width - Visual Preview -->
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Stroke Width</p>
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
              </div>

              <!-- Line Style - Visual Preview -->
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
            </div>
          }

          @if (activeTab === 'highlight') {
            <!-- HIGHLIGHT TAB -->
            <div class="space-y-3">

              <!-- New rule builder (collapsed when a rule is being edited) -->
              @if (!editDraft) {
                <div class="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-2">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">New Rule</p>

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

                  <div class="flex items-center gap-2">
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
                    <div class="flex items-center gap-1.5 ml-auto">
                      <input
                        type="color"
                        class="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                        [(ngModel)]="draftColor"
                        title="Highlight color"
                      />
                      <button
                        class="px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-colors"
                        [class.bg-blue-500]="draftKey.trim()"
                        [class.text-white]="draftKey.trim()"
                        [class.hover:bg-blue-600]="draftKey.trim()"
                        [class.bg-gray-100]="!draftKey.trim()"
                        [class.text-gray-400]="!draftKey.trim()"
                        [disabled]="!draftKey.trim()"
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
                      <div class="rounded-lg border-2 p-2.5 space-y-2" [style.border-color]="editDraft!.color" [style.background-color]="editDraft!.color + '11'">
                        <div class="flex items-center justify-between">
                          <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Edit Rule</p>
                          <button class="text-[10px] text-gray-400 hover:text-gray-600" (click)="cancelEdit()">Cancel</button>
                        </div>

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
                            <svg viewBox="0 0 12 8" class="w-2.5 h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M1 6 L6 2 L11 6" />
                            </svg>
                          </button>
                          <button
                            class="w-4 h-3.5 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors rounded"
                            title="Move down (lower priority)"
                            [disabled]="idx === tagRules.length - 1"
                            (click)="moveRule(rule.id, 1)"
                          >
                            <svg viewBox="0 0 12 8" class="w-2.5 h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M1 2 L6 6 L11 2" />
                            </svg>
                          </button>
                        </div>

                        <!-- Color swatch -->
                        <span class="w-3 h-3 rounded-sm flex-shrink-0" [style.background-color]="rule.color"></span>

                        <!-- Summary -->
                        <div class="flex-1 min-w-0">
                          <p class="text-[11px] font-medium text-gray-700 truncate">
                            {{ rule.tagKey }} {{ operatorLabel(rule.operator) }}{{ rule.tagValue ? ' ' + rule.tagValue : '' }}
                          </p>
                          <p class="text-[10px] text-gray-400 truncate">
                            {{ targetLabel(rule.target) }}{{ rule.badgeLabel ? ' · "' + rule.badgeLabel + '"' : '' }}
                          </p>
                        </div>

                        <!-- Actions (edit + delete) -->
                        <div class="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-blue-500 transition-colors rounded"
                            title="Edit rule"
                            (click)="beginEdit(rule)"
                          >
                            <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M13 3 L17 7 L7 17 L3 17 L3 13 Z" />
                              <path d="M11 5 L15 9" />
                            </svg>
                          </button>
                          <button
                            class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors rounded"
                            title="Delete rule"
                            (click)="removeRule(rule.id)"
                          >
                            <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                              <path d="M4 4 L16 16 M16 4 L4 16" />
                            </svg>
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
            <!-- AZURE RESOURCES TAB -->
            <div class="space-y-3">
              <!-- Search + Category filter -->
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <svg viewBox="0 0 20 20" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <circle cx="8" cy="8" r="5" />
                    <path d="M13 13 L17 17" />
                  </svg>
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
                    <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                      <path d="M10 3 L10 6 M10 14 L10 17 M3 10 L6 10 M14 10 L17 10" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-blue-700 truncate">{{ selectedResourceLabel }}</p>
                    <p class="text-[10px] text-blue-500">Click canvas to place</p>
                  </div>
                </div>
              } @else {
                <div class="flex items-center gap-2 px-2.5 py-2 bg-gray-50 rounded-lg">
                  <div class="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center">
                    <svg viewBox="0 0 20 20" class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                      <rect x="3" y="3" width="14" height="14" rx="2" />
                      <path d="M7 10 L13 10 M10 7 L10 13" />
                    </svg>
                  </div>
                  <p class="text-[10px] text-gray-400">Select a resource type above</p>
                </div>
              }
            </div>
          }

          @if (activeTab === 'actions') {
            <!-- ACTIONS TAB -->
            <div class="space-y-3">
              <!-- Quick Actions -->
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</p>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="h-10 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                    (click)="undo.emit()"
                  >
                    <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 10 A6 6 0 1 1 7 5" />
                      <path d="M4 6 L4 10 L8 10" />
                    </svg>
                    Undo
                  </button>
                  <button
                    class="h-10 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                    (click)="toolChange.emit('pointer')"
                  >
                    <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 2 L4 14 L7 11 L9 16 L11 15 L9 10 L13 10 Z" />
                    </svg>
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
                    <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="7" y="7" width="10" height="10" rx="1" />
                      <path d="M3 13 L3 4 C3 3.45 3.45 3 4 3 L13 3" />
                    </svg>
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
                    <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 6 L16 6 M8 6 L8 4 L12 4 L12 6 M6 6 L6 16 C6 17 7 17 7 17 L13 17 C13 17 14 17 14 16 L14 6" />
                    </svg>
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
                    <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="8" width="8" height="8" rx="1" />
                      <rect x="9" y="4" width="8" height="8" rx="1" fill="white" />
                    </svg>
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
                    <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="8" width="8" height="8" rx="1" />
                      <rect x="3" y="4" width="8" height="8" rx="1" fill="white" />
                    </svg>
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
                  <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="10" cy="10" r="7" />
                    <path d="M13 7 L7 13 M7 7 L13 13" />
                  </svg>
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
      }
    </div>
  `,
})
export class DrawingToolbarComponent implements OnInit {
  private readonly iconRegistry = inject(IconRegistryService);

  @Input() activeTool: DrawingTool = 'pointer';
  @Input() activeColor = '#1e1e1e';
  @Input() activeFontFamily = 'Arial, sans-serif';
  @Input() activeStrokeWidth = 2;
  @Input() activeStrokeStyle: StrokeStyle = 'solid';
  @Input() activeSloppiness = 0;
  @Input() activeEdgeRouting: EdgeRouting = 'straight';
  @Input() activeEdgeMode: EdgeMode = 'end';
  @Input() activeFill = 'none';
  @Input() activeFillOpacity = 0.2;
  @Input() canEditTextStyle = false;
  @Input() hasSelection = false;
  @Input() annotationCount = 0;
  @Input() tagRules: TagRule[] = [];
  @Input() availableTags = new Map<string, Set<string>>();
  @Input() activeResourceType = '';

  @Output() tagRulesChange = new EventEmitter<TagRule[]>();

  @Output() toolChange = new EventEmitter<DrawingTool>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() fontFamilyChange = new EventEmitter<string>();
  @Output() strokeWidthChange = new EventEmitter<number>();
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
    this.resourceCatalog = this.iconRegistry.getResourceTypeCatalog();
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
  draftOperator: TagRuleOperator = 'eq';
  draftValue = '';
  draftColor = '#ef4444';
  draftTarget: TagRule['target'] = 'node';
  draftBadge = '';

  get tagKeyOptions(): string[] {
    return Array.from(this.availableTags.keys()).sort();
  }

  get tagValueOptions(): string[] {
    if (!this.draftKey) return [];
    return Array.from(this.availableTags.get(this.draftKey) ?? []).sort();
  }

  addRule(): void {
    if (!this.draftKey.trim()) return;
    const rule: TagRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tagKey: this.draftKey.trim(),
      operator: this.draftOperator,
      tagValue: this.draftValue.trim(),
      target: this.draftTarget,
      color: this.draftColor,
      badgeLabel: this.draftBadge.trim() || undefined,
    };
    this.tagRulesChange.emit([...this.tagRules, rule]);
    this.draftKey = '';
    this.draftValue = '';
    this.draftBadge = '';
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

  targetLabel(target: TagRule['target']): string {
    const map: Record<TagRule['target'], string> = {
      node: 'Nodes', rg: 'Resource Groups', sub: 'Subscriptions', both: 'RG + Sub',
    };
    return map[target];
  }

  beginEdit(rule: TagRule): void {
    this.editDraft = { ...rule };
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

  readonly toolCategories = [
    { id: 'select' as const, label: 'Selection' },
    { id: 'draw' as const, label: 'Lines' },
    { id: 'shape' as const, label: 'Shapes' },
    { id: 'annotate' as const, label: 'Annotations' },
  ];

  activeTab: TabId = 'tools';
  collapsed = false;

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
      draw: 'Click and drag to draw freely',
      line: 'Click and drag to draw a line',
      arrow: 'Click and drag to draw an arrow',
      text: 'Click to place text',
      rect: 'Click and drag to draw a rectangle',
      ellipse: 'Click and drag to draw an ellipse',
      diamond: 'Click and drag to draw a diamond',
      sticky: 'Click to place a sticky note',
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
    return ['rect', 'ellipse', 'diamond', 'sticky'].includes(this.activeTool);
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
    return (event.target as HTMLInputElement).value || '';
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
    const map: Record<string, DrawingTool> = { v: 'pointer', p: 'draw', l: 'line', a: 'arrow', t: 'text', r: 'rect', e: 'ellipse', d: 'diamond', s: 'sticky' };
    const tool = map[e.key.toLowerCase()];
    if (!hasModifier && tool) { e.preventDefault(); this.toolChange.emit(tool); }
    if (e.key === 'Escape') this.toolChange.emit('pointer');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.undo.emit();
    }
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
}
