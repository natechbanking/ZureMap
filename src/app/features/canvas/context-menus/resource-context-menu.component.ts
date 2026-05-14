import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import { ActionIconComponent } from '../../../shared/components/action-icon/action-icon.component';

@Component({
  selector: 'app-resource-context-menu',
  standalone: true,
  imports: [CommonModule, ActionIconComponent],
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
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyObject.emit()">
          <app-action-icon icon="copy" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Copy
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" [disabled]="!canPaste" (click)="pasteObject.emit()">
          <app-action-icon icon="paste" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Paste
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="nodeFocused.emit()">
          <app-action-icon icon="focus" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Open details
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyName.emit()">
          <app-action-icon icon="copy" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Copy name
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50" (click)="copyResourceId.emit()">
          <app-action-icon icon="link" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Copy resource ID
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="tagCount === 0"
          (click)="visualizeTags.emit()"
        >
          <app-action-icon icon="tags" iconClass="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Visualize tags @if (tagCount > 0) { ({{ tagCount }}) }
        </button>
      </div>
      @if (showBind) {
        <div class="border-t border-gray-100 py-0.5">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-green-700 hover:bg-green-50"
            [title]="bindTitle"
            (click)="bindToParent.emit()"
          >
            <app-action-icon icon="link" iconClass="w-3.5 h-3.5 shrink-0 text-green-700" />
            {{ bindLabel || 'Bind to container' }}
          </button>
        </div>
      }
      @if (parentLabel) {
        <div class="border-t border-gray-100 py-0.5">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50" (click)="detachFromParent.emit()">
            <app-action-icon icon="detach" iconClass="w-3.5 h-3.5 shrink-0 text-red-600" />
            Break out of {{ parentLabel }}
          </button>
        </div>
      }
      @if (showResetBreakout) {
        <div class="border-t border-gray-100 py-0.5">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-blue-700 hover:bg-blue-50" (click)="resetBreakout.emit()">
            <app-action-icon icon="reset" iconClass="w-3.5 h-3.5 shrink-0 text-blue-700" />
            {{ resetBreakoutLabel || 'Reset breakout' }}
          </button>
        </div>
      }
      <div class="border-t border-gray-100 py-0.5">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50" (click)="delete.emit()">
          <app-action-icon icon="delete" iconClass="w-3.5 h-3.5 shrink-0 text-red-600" />
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
  @Input() showBind = false;
  @Input() bindLabel = '';
  @Input() bindTitle = '';
  @Input() showResetBreakout = false;
  @Input() resetBreakoutLabel = '';
  @Input() canPaste = false;

  @Output() copyObject = new EventEmitter<void>();
  @Output() pasteObject = new EventEmitter<void>();
  @Output() nodeFocused = new EventEmitter<void>();
  @Output() copyName = new EventEmitter<void>();
  @Output() copyResourceId = new EventEmitter<void>();
  @Output() visualizeTags = new EventEmitter<void>();
  @Output() bindToParent = new EventEmitter<void>();
  @Output() detachFromParent = new EventEmitter<void>();
  @Output() resetBreakout = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  get tagCount(): number {
    const tags = this.node.metadata?.tags;
    if (!tags || typeof tags !== 'object') return 0;
    return Object.keys(tags).length;
  }
}
