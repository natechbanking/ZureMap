import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-rg-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed z-[191] w-56 rounded-lg bg-white border border-gray-200 shadow-xl py-1 select-none"
      [style.left.px]="x"
      [style.top.px]="y"
      role="presentation"
      (click)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      <div class="px-3 py-1.5 border-b border-gray-100">
        <p class="text-[11px] font-semibold text-gray-800 truncate" [title]="name">{{ name }}</p>
        <p class="text-[10px] text-gray-400 truncate">Resource Group</p>
      </div>
      <div class="py-0.5">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="busy"
          (click)="autoLayout.emit()"
        >
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2.5" y="2.5" width="3" height="3" rx="0.6"/>
            <rect x="10.5" y="2.5" width="3" height="3" rx="0.6"/>
            <rect x="2.5" y="10.5" width="3" height="3" rx="0.6"/>
            <rect x="10.5" y="10.5" width="3" height="3" rx="0.6"/>
            <path d="M5.5 4h5M4 5.5v5M12 5.5v5M5.5 12h5"/>
          </svg>
          {{ busy ? 'Auto-layout…' : 'Auto-layout' }}
        </button>
      </div>
    </div>
  `,
})
export class RgContextMenuComponent {
  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;
  @Input({ required: true }) name!: string;
  @Input() busy = false;
  @Output() autoLayout = new EventEmitter<void>();
}

