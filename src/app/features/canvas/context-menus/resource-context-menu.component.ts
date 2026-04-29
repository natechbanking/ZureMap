import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DiagramNode } from '../../../core/models/diagram-node.model';

@Component({
  selector: 'app-resource-context-menu',
  standalone: true,
  imports: [CommonModule],
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
        <p class="text-[11px] font-semibold text-gray-800 truncate" [title]="node.label">{{ node.label }}</p>
        <p class="text-[10px] text-gray-400 truncate">{{ node.resourceType.split('/').pop() }}</p>
      </div>
      <div class="py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="nodeFocused.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6"/>
            <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>
          </svg>
          Focus in sidebar
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyName.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="5" width="9" height="9" rx="1.5"/>
            <path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/>
          </svg>
          Copy name
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyResourceId.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2"/>
            <path d="M10 4h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
            <line x1="5" y1="8" x2="11" y2="8"/>
          </svg>
          Copy resource ID
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="tagCount === 0"
          (click)="visualizeTags.emit()"
        >
          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2.5 5.5h4l6-3v8l-6-3h-4z"/>
            <path d="M3 10.5l2 3"/>
          </svg>
          Visualize tags @if (tagCount > 0) { ({{ tagCount }}) }
        </button>
      </div>
      @if (parentLabel) {
        <div class="border-t border-gray-100 py-0.5">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="detachFromParent.emit()">
            <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2.5" y="5.5" width="8" height="8" rx="1.5"/>
              <path d="M8 2.5h5.5V8"/>
              <path d="M13.5 2.5L7.5 8.5"/>
            </svg>
            Break out of {{ parentLabel }}
          </button>
        </div>
      }
      @if (showResetBreakout) {
        <div class="border-t border-gray-100 py-0.5">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-blue-700 hover:bg-blue-50" (click)="resetBreakout.emit()">
            <svg class="w-3.5 h-3.5 shrink-0 text-blue-700" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="5.5" y="2.5" width="8" height="8" rx="1.5"/>
              <path d="M8 13.5H2.5V8"/>
              <path d="M2.5 13.5L8.5 7.5"/>
            </svg>
            {{ resetBreakoutLabel || 'Reset breakout' }}
          </button>
        </div>
      }
      <div class="border-t border-gray-100 py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50" (click)="delete.emit()">
          <svg class="w-3.5 h-3.5 shrink-0 text-red-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
          </svg>
          Delete from diagram
        </button>
      </div>
    </div>
  `,
})
export class ResourceContextMenuComponent {
  @Input({ required: true }) node!: DiagramNode;
  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;
  @Input() parentLabel: string | null = null;
  @Input() showResetBreakout = false;
  @Input() resetBreakoutLabel = '';

  @Output() nodeFocused = new EventEmitter<void>();
  @Output() copyName = new EventEmitter<void>();
  @Output() copyResourceId = new EventEmitter<void>();
  @Output() visualizeTags = new EventEmitter<void>();
  @Output() detachFromParent = new EventEmitter<void>();
  @Output() resetBreakout = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  get tagCount(): number {
    const tags = this.node.metadata?.tags;
    if (!tags || typeof tags !== 'object') return 0;
    return Object.keys(tags).length;
  }
}
