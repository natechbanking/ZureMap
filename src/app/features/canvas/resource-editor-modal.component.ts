import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ResourceEditorDraft } from './canvas.types';

@Component({
  selector: 'app-resource-editor-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-[170] bg-black/30 flex items-center justify-center p-4" role="presentation" (click)="closed.emit()" (keydown.escape)="closed.emit()">
      <div class="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl" role="presentation" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900">Edit Resource</h3>
          <button class="text-xs text-gray-500 hover:text-gray-700" (click)="closed.emit()">Close</button>
        </div>

        <div class="p-4 grid grid-cols-2 gap-3">
          <label class="text-xs text-gray-600">Name
            <input class="mt-1 w-full h-9 rounded border border-gray-200 px-2 text-sm" [value]="draft.label" (input)="setField('label', textValue($event))" />
          </label>
          <label class="text-xs text-gray-600">Status
            <select class="mt-1 w-full h-9 rounded border border-gray-200 px-2 text-sm" [value]="draft.status" (change)="setStatus(selectValue($event))">
              <option value="running">running</option>
              <option value="stopped">stopped</option>
              <option value="failed">failed</option>
              <option value="unknown">unknown</option>
            </select>
          </label>
          <label class="text-xs text-gray-600">Location
            <input class="mt-1 w-full h-9 rounded border border-gray-200 px-2 text-sm" [value]="draft.location" (input)="setField('location', textValue($event))" />
          </label>
          <label class="text-xs text-gray-600">Resource Group
            <input class="mt-1 w-full h-9 rounded border border-gray-200 px-2 text-sm" [value]="draft.resourceGroup" (input)="setField('resourceGroup', textValue($event))" />
          </label>
        </div>

        <div class="px-4 pb-4">
          <label class="text-xs text-gray-600 block">Description / Notes
            <textarea class="mt-1 w-full rounded border border-gray-200 px-2 py-2 text-sm min-h-20" [value]="draft.description" (input)="setField('description', textValue($event))"></textarea>
          </label>
        </div>

        <div class="px-4 pb-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Internal Text Items</p>
            <button class="h-7 px-2 rounded border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="addInternalItem.emit()">Add Text</button>
          </div>
          <div class="space-y-2 max-h-40 overflow-auto">
            @for (item of draft.internalItems; track item.id) {
              <div class="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input class="h-8 rounded border border-gray-200 px-2 text-xs" [value]="item.text" (input)="updateInternalItemText.emit({ itemId: item.id, text: textValue($event) })" />
                <input class="h-8 w-10 rounded border border-gray-200 p-1 cursor-pointer" type="color" title="Text color" aria-label="Text color" [value]="item.color ?? '#1d4ed8'" (input)="updateInternalItemColor.emit({ itemId: item.id, color: textValue($event) })" />
                <input class="h-8 w-10 rounded border border-gray-200 p-1 cursor-pointer" type="color" title="Background color" aria-label="Background color" [value]="item.backgroundColor ?? '#eff6ff'" (input)="updateInternalItemBackgroundColor.emit({ itemId: item.id, backgroundColor: textValue($event) })" />
                <button class="h-8 px-2 rounded border border-red-200 text-xs text-red-600 hover:bg-red-50" (click)="removeInternalItem.emit(item.id)">Remove</button>
              </div>
            }
          </div>
          <p class="text-[11px] text-gray-400 mt-2">Tip: after saving, drag these labels inside the resource box on the canvas.</p>
        </div>

        <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button class="h-9 px-3 rounded border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="closed.emit()">Cancel</button>
          <button class="h-9 px-3 rounded bg-blue-600 text-xs text-white hover:bg-blue-700" (click)="save.emit()">Save Changes</button>
        </div>
      </div>
    </div>
  `,
})
export class ResourceEditorModalComponent {
  @Input({ required: true }) draft!: ResourceEditorDraft;

  @Output() closed = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<ResourceEditorDraft>();
  @Output() addInternalItem = new EventEmitter<void>();
  @Output() removeInternalItem = new EventEmitter<string>();
  @Output() updateInternalItemText = new EventEmitter<{ itemId: string; text: string }>();
  @Output() updateInternalItemColor = new EventEmitter<{ itemId: string; color: string }>();
  @Output() updateInternalItemBackgroundColor = new EventEmitter<{ itemId: string; backgroundColor: string }>();

  setField<K extends keyof Pick<ResourceEditorDraft, 'label' | 'location' | 'resourceGroup' | 'description'>>(
    key: K,
    value: ResourceEditorDraft[K],
  ): void {
    this.draftChange.emit({ ...this.draft, [key]: value });
  }

  setStatus(status: string): void {
    if (status !== 'running' && status !== 'stopped' && status !== 'failed' && status !== 'unknown') return;
    this.draftChange.emit({ ...this.draft, status });
  }

  textValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value ?? '';
  }

  selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }
}
