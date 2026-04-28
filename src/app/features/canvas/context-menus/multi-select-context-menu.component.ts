import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-multi-select-context-menu',
  standalone: true,
  template: `
    <div
      class="fixed z-[191] w-52 rounded-lg bg-white border border-gray-200 shadow-xl py-1 select-none"
      [style.left.px]="x"
      [style.top.px]="y"
      (click)="$event.stopPropagation()"
    >
      <div class="px-3 py-1.5 border-b border-gray-100">
        <p class="text-[11px] font-semibold text-gray-800">{{ count }} resources selected</p>
      </div>
      <div class="py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyNames.emit(); close.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="5" width="9" height="9" rx="1.5"/>
            <path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/>
          </svg>
          Copy names
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="detachAll.emit(); close.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2.5" y="5.5" width="8" height="8" rx="1.5"/>
            <path d="M8 2.5h5.5V8"/>
            <path d="M13.5 2.5L7.5 8.5"/>
          </svg>
          Detach from parent
        </button>
      </div>
      <div class="border-t border-gray-100 py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50" (click)="deleteAll.emit(); close.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-red-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
          </svg>
          Delete all from diagram
        </button>
      </div>
    </div>
  `,
})
export class MultiSelectContextMenuComponent {
  @Input({ required: true }) count!: number;
  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;

  @Output() deleteAll = new EventEmitter<void>();
  @Output() copyNames = new EventEmitter<void>();
  @Output() detachAll = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
