import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Annotation } from '../../../core/models/annotation.model';

@Component({
  selector: 'app-annotation-context-menu',
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
        <p class="text-[11px] font-semibold text-gray-800 truncate">Annotation</p>
        <p class="text-[10px] text-gray-400 capitalize">{{ annotation?.type ?? 'shape' }}</p>
      </div>
      <div class="py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyObject.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="5" width="9" height="9" rx="1.5"/>
            <path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/>
          </svg>
          Copy
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" [disabled]="!canPaste" (click)="pasteObject.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 2.5h7l3 3V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/>
            <path d="M10 2.5V6h3"/>
            <rect x="5" y="8" width="6" height="4" rx="0.75"/>
          </svg>
          Paste
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="duplicate.emit()">Duplicate</button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="bringFront.emit()">Bring to front</button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="sendBack.emit()">Send to back</button>
        @if (isTextual) {
          <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="editText.emit()">Edit text</button>
          <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyText.emit()">Copy text</button>
        }
      </div>
      <div class="border-t border-gray-100 py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50" (click)="delete.emit()">Delete annotation</button>
      </div>
    </div>
  `,
})
export class AnnotationContextMenuComponent {
  @Input() annotation: Annotation | null = null;
  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;
  @Input() canPaste = false;

  @Output() copyObject = new EventEmitter<void>();
  @Output() pasteObject = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<void>();
  @Output() bringFront = new EventEmitter<void>();
  @Output() sendBack = new EventEmitter<void>();
  @Output() editText = new EventEmitter<void>();
  @Output() copyText = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  get isTextual(): boolean {
    return this.annotation?.type === 'text' || this.annotation?.type === 'sticky';
  }
}
