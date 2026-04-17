import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawingTool } from '../../../core/models/annotation.model';

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
  { id: 'arrow',    label: 'Arrow',     key: 'A', icon: 'M3 10 L17 10 M12 5 L17 10 L12 15' },
  { id: 'text',     label: 'Text',      key: 'T', icon: 'M3 5 L17 5 M10 5 L10 17 M7 17 L13 17' },
  { id: 'rect',     label: 'Rectangle', key: 'R', icon: 'M3 4 L17 4 L17 16 L3 16 Z' },
  { id: 'ellipse',  label: 'Ellipse',   key: 'E', icon: 'M10 4 A7 5 0 1 0 10 16 A7 5 0 1 0 10 4' },
  { id: 'sticky',   label: 'Sticky',    key: 'S', icon: 'M3 3 L14 3 L17 6 L17 17 L3 17 Z M14 3 L14 6 L17 6' },
];

const COLORS = [
  '#1e1e1e', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899',
];

const WIDTHS = [1, 2, 4, 8];

@Component({
  selector: 'app-drawing-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-0.5 p-1.5 bg-white rounded-2xl shadow-xl border border-gray-200 select-none" style="width:52px">

      <!-- Tools -->
      @for (tool of tools; track tool.id) {
        <button
          class="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors group"
          [class.bg-blue-100]="activeTool === tool.id"
          [class.text-blue-600]="activeTool === tool.id"
          [class.text-gray-600]="activeTool !== tool.id"
          [class.hover:bg-gray-100]="activeTool !== tool.id"
          [title]="tool.label + '  (' + tool.key + ')'"
          (click)="toolChange.emit(tool.id)"
        >
          <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" [attr.stroke]="activeTool === tool.id ? '#2563eb' : '#374151'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path [attr.d]="tool.icon" />
          </svg>
        </button>
      }

      <div class="h-px bg-gray-200 my-1 mx-1"></div>

      <!-- Color grid -->
      <div class="grid grid-cols-2 gap-1 px-0.5 pb-1">
        @for (c of colors; track c) {
          <button
            class="w-4 h-4 rounded-full border-2 transition-all hover:scale-110"
            [style.background-color]="c"
            [class.border-blue-500]="activeColor === c"
            [class.border-transparent]="activeColor !== c"
            [title]="c"
            (click)="colorChange.emit(c)"
          ></button>
        }
      </div>

      <div class="h-px bg-gray-200 mb-1 mx-1"></div>

      <!-- Stroke widths -->
      <div class="flex flex-col gap-1 px-1.5 pb-1">
        @for (w of widths; track w) {
          <button
            class="flex items-center justify-center h-5 rounded transition-colors hover:bg-gray-100"
            [class.bg-blue-50]="activeStrokeWidth === w"
            [title]="w + 'px'"
            (click)="strokeWidthChange.emit(w)"
          >
            <div class="rounded-full bg-gray-600" [style.width.px]="28" [style.height.px]="w"></div>
          </button>
        }
      </div>

      <div class="h-px bg-gray-200 my-1 mx-1"></div>

      <!-- Fill toggle (for rect/ellipse/sticky) -->
      <button
        class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-xs font-bold"
        [class.bg-blue-100]="activeFill !== 'none'"
        [class.text-blue-600]="activeFill !== 'none'"
        [class.text-gray-500]="activeFill === 'none'"
        [class.hover:bg-gray-100]="activeFill === 'none'"
        title="Toggle fill"
        (click)="fillChange.emit(activeFill === 'none' ? activeColor : 'none')"
      >
        <svg viewBox="0 0 20 20" class="w-4 h-4">
          <rect x="3" y="3" width="14" height="14" rx="2"
            [attr.fill]="activeFill !== 'none' ? activeColor : 'none'"
            [attr.stroke]="activeFill !== 'none' ? activeColor : '#6b7280'"
            stroke-width="1.6" />
        </svg>
      </button>

      <div class="h-px bg-gray-200 my-1 mx-1"></div>

      <!-- Undo -->
      <button
        class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        title="Undo last (Ctrl+Z)"
        (click)="undo.emit()"
      >
        <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="#6b7280" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 10 A6 6 0 1 1 7 5" />
          <path d="M4 6 L4 10 L8 10" />
        </svg>
      </button>

      <!-- Clear all -->
      <button
        class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        title="Clear all annotations"
        (click)="clearAll.emit()"
      >
        <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6 L17 6 M8 6 L8 3 L12 3 L12 6 M5 6 L5 17 L15 17 L15 6 M8 10 L8 14 M12 10 L12 14" />
        </svg>
      </button>

    </div>
  `,
})
export class DrawingToolbarComponent {
  @Input() activeTool: DrawingTool = 'pointer';
  @Input() activeColor = '#1e1e1e';
  @Input() activeStrokeWidth = 2;
  @Input() activeFill = 'none';

  @Output() toolChange = new EventEmitter<DrawingTool>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() strokeWidthChange = new EventEmitter<number>();
  @Output() fillChange = new EventEmitter<string>();
  @Output() undo = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();

  readonly tools = TOOLS;
  readonly colors = COLORS;
  readonly widths = WIDTHS;

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    const map: Record<string, DrawingTool> = { v: 'pointer', p: 'draw', a: 'arrow', t: 'text', r: 'rect', e: 'ellipse', s: 'sticky' };
    const tool = map[e.key.toLowerCase()];
    if (tool) { e.preventDefault(); this.toolChange.emit(tool); }
    if (e.key === 'Escape') this.toolChange.emit('pointer');
  }
}
