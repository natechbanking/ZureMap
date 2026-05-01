import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActionIconComponent } from '../../../shared/components/action-icon/action-icon.component';

@Component({
  selector: 'app-multi-select-context-menu',
  standalone: true,
  imports: [ActionIconComponent],
  template: `
    <div
      class="fixed z-[191] w-52 rounded-lg bg-white border border-gray-200 shadow-xl py-1 select-none"
      [style.left.px]="x"
      [style.top.px]="y"
      role="presentation"
      (click)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      <div class="px-3 py-1.5 border-b border-gray-100">
        <p class="text-[11px] font-semibold text-gray-800">{{ count }} resources selected</p>
      </div>
      <div class="py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyObjects.emit(); closed.emit()">
          <app-action-icon icon="copy" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Copy
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" [disabled]="!canPaste" (click)="pasteObjects.emit(); closed.emit()">
          <app-action-icon icon="paste" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Paste
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyNames.emit(); closed.emit()">
          <app-action-icon icon="copy" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Copy names
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="detachAll.emit(); closed.emit()">
          <app-action-icon icon="detach" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Detach from parent
        </button>
      </div>
      <div class="border-t border-gray-100 py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50" (click)="deleteAll.emit(); closed.emit()">
          <app-action-icon icon="delete" iconClass="w-3.5 h-3.5 shrink-0 text-red-600" />
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
  @Input() canPaste = false;

  @Output() copyObjects = new EventEmitter<void>();
  @Output() pasteObjects = new EventEmitter<void>();
  @Output() deleteAll = new EventEmitter<void>();
  @Output() copyNames = new EventEmitter<void>();
  @Output() detachAll = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
