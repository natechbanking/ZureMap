import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-zoom-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="absolute bottom-4 z-[130] flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-gray-200 bg-white/95 backdrop-blur shadow"
      [style.right.px]="right"
    >
      <button
        class="w-7 h-7 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
        title="Zoom out"
        (click)="zoomOut.emit()"
      >-</button>
      <button
        class="px-2 h-7 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
        title="Reset zoom"
        (click)="resetZoom.emit()"
      >{{ zoomPercent }}%</button>
      <button
        class="w-7 h-7 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
        title="Zoom in"
        (click)="zoomIn.emit()"
      >+</button>

      <div class="w-px h-4 bg-gray-200 mx-0.5"></div>

      <button
        class="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center transition-colors"
        [class.bg-blue-500]="minimapOpen"
        [class.border-blue-500]="minimapOpen"
        [class.text-white]="minimapOpen"
        [class.text-gray-700]="!minimapOpen"
        [class.hover:bg-gray-50]="!minimapOpen"
        [title]="minimapOpen ? 'Hide minimap' : 'Show minimap'"
        (click)="toggleMinimap.emit()"
      >
        <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 4 L8 7 L12 4 L17 7 L17 16 L12 13 L8 16 L3 13 Z" />
          <path d="M8 7 L8 16 M12 4 L12 13" />
        </svg>
      </button>
    </div>
  `,
})
export class ZoomControlsComponent {
  @Input({ required: true }) zoomPercent!: number;
  @Input({ required: true }) right!: number;
  @Input() minimapOpen = false;

  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() resetZoom = new EventEmitter<void>();
  @Output() toggleMinimap = new EventEmitter<void>();
}
