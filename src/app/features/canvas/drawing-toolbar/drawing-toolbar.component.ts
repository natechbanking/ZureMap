import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawingTool, StrokeStyle, EdgeRouting, EdgeMode } from '../../../core/models/annotation.model';

interface Tool {
  id: DrawingTool;
  label: string;
  key: string;
  // viewBox 0 0 20 20 SVG path
  icon: string;
}

const TOOLS: Tool[] = [
  { id: 'pointer',  label: 'Select',    key: 'V', icon: 'M4 2 L4 14 L7 11 L9 16 L11 15 L9 10 L13 10 Z' },
  { id: 'draw',     label: 'Draw',      key: 'P', icon: 'M14 2 L18 6 L7 17 L3 18 L4 14 Z M14 2 L18 6' },
  { id: 'line',     label: 'Line',      key: 'L', icon: 'M3 15 L17 5' },
  { id: 'arrow',    label: 'Arrow',     key: 'A', icon: 'M3 10 L17 10 M12 5 L17 10 L12 15' },
  { id: 'text',     label: 'Text',      key: 'T', icon: 'M3 5 L17 5 M10 5 L10 17 M7 17 L13 17' },
  { id: 'rect',     label: 'Rectangle', key: 'R', icon: 'M3 4 L17 4 L17 16 L3 16 Z' },
  { id: 'ellipse',  label: 'Ellipse',   key: 'E', icon: 'M10 4 A7 5 0 1 0 10 16 A7 5 0 1 0 10 4' },
  { id: 'diamond',  label: 'Diamond',   key: 'D', icon: 'M10 2 L18 10 L10 18 L2 10 Z' },
  { id: 'sticky',   label: 'Sticky',    key: 'S', icon: 'M3 3 L14 3 L17 6 L17 17 L3 17 Z M14 3 L14 6 L17 6' },
];

const COLORS = [
  '#1e1e1e', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899',
  '#14b8a6', '#0ea5e9', '#6366f1', '#f59e0b',
];

const WIDTHS = [1, 2, 4, 6, 8];
const STROKE_STYLES: StrokeStyle[] = ['solid', 'dashed', 'dotted'];
const EDGE_ROUTINGS: EdgeRouting[] = ['straight', 'elbow'];
const EDGE_MODES: EdgeMode[] = ['none', 'start', 'end', 'both'];

@Component({
  selector: 'app-drawing-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 select-none overflow-hidden transition-all"
      [style.width.px]="collapsed ? 58 : 300">

      <div class="flex items-center gap-2 px-2.5 py-2 border-b border-gray-200 bg-gray-50/80">
        <div class="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
          <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 14 L8 9 L11 12 L17 6" />
            <path d="M14 6 L17 6 L17 9" />
          </svg>
        </div>
        <div class="min-w-0 flex-1" [class.hidden]="collapsed">
          <p class="text-sm font-semibold text-gray-800">Diagram Tools</p>
          <p class="text-[11px] text-gray-500">{{ annotationCount }} annotation{{ annotationCount === 1 ? '' : 's' }}</p>
        </div>
        <button
          class="w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-200/70 transition-colors"
          [title]="collapsed ? 'Expand tools' : 'Collapse tools'"
          (click)="collapsed = !collapsed"
        >
          {{ collapsed ? '>' : '<' }}
        </button>
      </div>

      @if (collapsed) {
        <div class="p-2 flex flex-col gap-1.5">
          @for (tool of compactTools; track tool.id) {
            <button
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              [class.bg-blue-100]="activeTool === tool.id"
              [class.text-blue-600]="activeTool === tool.id"
              [class.text-gray-600]="activeTool !== tool.id"
              [class.hover:bg-gray-100]="activeTool !== tool.id"
              [title]="tool.label + ' (' + tool.key + ')'"
              (click)="toolChange.emit(tool.id)"
            >
              <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" [attr.stroke]="activeTool === tool.id ? '#2563eb' : '#374151'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path [attr.d]="tool.icon" />
              </svg>
            </button>
          }
          <button
            class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            title="Undo (Ctrl+Z)"
            (click)="undo.emit()"
          >
            <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 10 A6 6 0 1 1 7 5" />
              <path d="M4 6 L4 10 L8 10" />
            </svg>
          </button>
        </div>
      } @else {
        <div class="p-2.5 space-y-3">
          <div>
            <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Modes</p>
            <div class="grid grid-cols-5 gap-1.5">
              @for (tool of tools; track tool.id) {
                <button
                  class="relative h-11 rounded-xl border text-gray-700 flex flex-col items-center justify-center gap-0.5 transition-colors"
                  [class.bg-blue-50]="activeTool === tool.id"
                  [class.border-blue-300]="activeTool === tool.id"
                  [class.text-blue-700]="activeTool === tool.id"
                  [class.border-gray-200]="activeTool !== tool.id"
                  [class.hover:bg-gray-50]="activeTool !== tool.id"
                  [title]="tool.label + ' (' + tool.key + ')'"
                  (click)="toolChange.emit(tool.id)"
                >
                  <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" [attr.stroke]="activeTool === tool.id ? '#1d4ed8' : '#374151'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <path [attr.d]="tool.icon" />
                  </svg>
                  <span class="text-[10px] leading-none">{{ tool.label }}</span>
                </button>
              }
            </div>
          </div>

          <div>
            <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quick Insert</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('sticky')">Sticky</button>
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('text')">Text</button>
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('arrow')">Connector</button>
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('line')">Line</button>
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('diamond')">Decision</button>
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('rect')">Process</button>
            </div>
          </div>

          <div class="grid grid-cols-[1fr_auto] gap-2 items-start">
            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stroke Color</p>
              <div class="grid grid-cols-6 gap-1.5">
                @for (c of colors; track c) {
                  <button
                    class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-105"
                    [style.background-color]="c"
                    [class.border-blue-500]="activeColor === c"
                    [class.border-transparent]="activeColor !== c"
                    [title]="c"
                    (click)="colorChange.emit(c)"
                  ></button>
                }
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Custom</p>
              <input
                type="color"
                class="w-9 h-9 p-0 border border-gray-200 rounded-lg cursor-pointer"
                [value]="activeColor"
                (input)="onCustomColor($event)"
                title="Custom stroke color"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stroke Width</p>
              <div class="flex flex-wrap gap-1">
                @for (w of widths; track w) {
                  <button
                    class="h-7 min-w-9 px-2 rounded-lg border text-xs transition-colors"
                    [class.border-blue-300]="activeStrokeWidth === w"
                    [class.bg-blue-50]="activeStrokeWidth === w"
                    [class.text-blue-700]="activeStrokeWidth === w"
                    [class.border-gray-200]="activeStrokeWidth !== w"
                    [class.text-gray-600]="activeStrokeWidth !== w"
                    (click)="strokeWidthChange.emit(w)"
                  >{{ w }}px</button>
                }
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Fill</p>
              <div class="flex gap-1">
                <button
                  class="h-7 px-2 rounded-lg border text-xs"
                  [class.border-blue-300]="activeFill !== 'none'"
                  [class.bg-blue-50]="activeFill !== 'none'"
                  [class.text-blue-700]="activeFill !== 'none'"
                  [class.border-gray-200]="activeFill === 'none'"
                  [class.text-gray-600]="activeFill === 'none'"
                  (click)="fillChange.emit(activeFill === 'none' ? activeColor : 'none')"
                >{{ activeFill === 'none' ? 'Off' : 'On' }}</button>
                <button
                  class="w-7 h-7 rounded-lg border border-gray-200"
                  [style.background]="activeFill !== 'none' ? activeFill : 'linear-gradient(135deg, #ffffff 45%, #e5e7eb 45%, #e5e7eb 55%, #ffffff 55%)'"
                  title="Set fill to stroke color"
                  (click)="fillChange.emit(activeColor)"
                ></button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stroke Style</p>
              <div class="flex flex-wrap gap-1">
                @for (s of strokeStyles; track s) {
                  <button
                    class="h-7 min-w-12 px-2 rounded-lg border text-xs capitalize transition-colors"
                    [class.border-blue-300]="activeStrokeStyle === s"
                    [class.bg-blue-50]="activeStrokeStyle === s"
                    [class.text-blue-700]="activeStrokeStyle === s"
                    [class.border-gray-200]="activeStrokeStyle !== s"
                    [class.text-gray-600]="activeStrokeStyle !== s"
                    (click)="strokeStyleChange.emit(s)"
                  >{{ s }}</button>
                }
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sloppiness</p>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  class="w-full"
                  [value]="activeSloppiness"
                  (input)="sloppinessChange.emit(toNumber($event))"
                />
                <span class="text-xs text-gray-600 w-4 text-right">{{ activeSloppiness }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Routing</p>
              <div class="flex flex-wrap gap-1">
                @for (r of edgeRoutings; track r) {
                  <button
                    class="h-7 min-w-14 px-2 rounded-lg border text-xs capitalize transition-colors"
                    [class.border-blue-300]="activeEdgeRouting === r"
                    [class.bg-blue-50]="activeEdgeRouting === r"
                    [class.text-blue-700]="activeEdgeRouting === r"
                    [class.border-gray-200]="activeEdgeRouting !== r"
                    [class.text-gray-600]="activeEdgeRouting !== r"
                    (click)="edgeRoutingChange.emit(r)"
                  >{{ r }}</button>
                }
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Edges</p>
              <div class="flex flex-wrap gap-1">
                @for (m of edgeModes; track m) {
                  <button
                    class="h-7 min-w-12 px-2 rounded-lg border text-xs capitalize transition-colors"
                    [class.border-blue-300]="activeEdgeMode === m"
                    [class.bg-blue-50]="activeEdgeMode === m"
                    [class.text-blue-700]="activeEdgeMode === m"
                    [class.border-gray-200]="activeEdgeMode !== m"
                    [class.text-gray-600]="activeEdgeMode !== m"
                    (click)="edgeModeChange.emit(m)"
                  >{{ m }}</button>
                }
              </div>
            </div>
          </div>

          <div>
            <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Actions</p>
            <div class="grid grid-cols-2 gap-1.5">
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="undo.emit()">Undo</button>
              <button class="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="toolChange.emit('pointer')">Select Mode</button>
              <button
                class="h-8 rounded-lg border text-xs"
                [class.border-blue-200]="hasSelection"
                [class.text-blue-600]="hasSelection"
                [class.hover:bg-blue-50]="hasSelection"
                [class.border-gray-200]="!hasSelection"
                [class.text-gray-300]="!hasSelection"
                [disabled]="!hasSelection"
                (click)="duplicateSelected.emit()"
              >Duplicate</button>
              <button
                class="h-8 rounded-lg border text-xs"
                [class.border-blue-200]="hasSelection"
                [class.text-blue-600]="hasSelection"
                [class.hover:bg-blue-50]="hasSelection"
                [class.border-gray-200]="!hasSelection"
                [class.text-gray-300]="!hasSelection"
                [disabled]="!hasSelection"
                (click)="bringToFront.emit()"
              >Bring Front</button>
              <button
                class="h-8 rounded-lg border text-xs"
                [class.border-blue-200]="hasSelection"
                [class.text-blue-600]="hasSelection"
                [class.hover:bg-blue-50]="hasSelection"
                [class.border-gray-200]="!hasSelection"
                [class.text-gray-300]="!hasSelection"
                [disabled]="!hasSelection"
                (click)="sendToBack.emit()"
              >Send Back</button>
              <button
                class="h-8 rounded-lg border text-xs"
                [class.border-red-200]="hasSelection"
                [class.text-red-600]="hasSelection"
                [class.hover:bg-red-50]="hasSelection"
                [class.border-gray-200]="!hasSelection"
                [class.text-gray-300]="!hasSelection"
                [disabled]="!hasSelection"
                (click)="deleteSelected.emit()"
              >Delete Selected</button>
              <button
                class="h-8 rounded-lg border text-xs"
                [class.border-red-200]="annotationCount > 0"
                [class.text-red-600]="annotationCount > 0"
                [class.hover:bg-red-50]="annotationCount > 0"
                [class.border-gray-200]="annotationCount === 0"
                [class.text-gray-300]="annotationCount === 0"
                [disabled]="annotationCount === 0"
                (click)="clearAll.emit()"
              >Clear All</button>
            </div>
          </div>

          <div class="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
            Tips: <span class="font-mono">V</span> select, <span class="font-mono">L</span> line, <span class="font-mono">A</span> arrow, <span class="font-mono">D</span> diamond, <span class="font-mono">Ctrl/⌘+D</span> duplicate.
          </div>
        </div>
      }
    </div>
  `,
})
export class DrawingToolbarComponent {
  @Input() activeTool: DrawingTool = 'pointer';
  @Input() activeColor = '#1e1e1e';
  @Input() activeStrokeWidth = 2;
  @Input() activeStrokeStyle: StrokeStyle = 'solid';
  @Input() activeSloppiness = 0;
  @Input() activeEdgeRouting: EdgeRouting = 'straight';
  @Input() activeEdgeMode: EdgeMode = 'end';
  @Input() activeFill = 'none';
  @Input() hasSelection = false;
  @Input() annotationCount = 0;

  @Output() toolChange = new EventEmitter<DrawingTool>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() strokeWidthChange = new EventEmitter<number>();
  @Output() strokeStyleChange = new EventEmitter<StrokeStyle>();
  @Output() sloppinessChange = new EventEmitter<number>();
  @Output() edgeRoutingChange = new EventEmitter<EdgeRouting>();
  @Output() edgeModeChange = new EventEmitter<EdgeMode>();
  @Output() fillChange = new EventEmitter<string>();
  @Output() undo = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();
  @Output() deleteSelected = new EventEmitter<void>();
  @Output() duplicateSelected = new EventEmitter<void>();
  @Output() bringToFront = new EventEmitter<void>();
  @Output() sendToBack = new EventEmitter<void>();

  readonly tools = TOOLS;
  readonly colors = COLORS;
  readonly widths = WIDTHS;
  readonly strokeStyles = STROKE_STYLES;
  readonly edgeRoutings = EDGE_ROUTINGS;
  readonly edgeModes = EDGE_MODES;
  readonly compactTools = TOOLS.filter(t => ['pointer', 'line', 'arrow'].includes(t.id));

  collapsed = false;

  onCustomColor(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.colorChange.emit(value);
  }

  toNumber(event: Event): number {
    return Number((event.target as HTMLInputElement).value || 0);
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
