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
    </div>
  `,
})
export class ZoomControlsComponent {
  @Input({ required: true }) zoomPercent!: number;
  @Input({ required: true }) right!: number;

  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() resetZoom = new EventEmitter<void>();
}
