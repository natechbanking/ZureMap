import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-[170] bg-black/30 flex items-center justify-center p-4" role="presentation" (click)="closed.emit()" (keydown.escape)="closed.emit()">
      <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl" role="presentation" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900">Export Image</h3>
          <button class="text-xs text-gray-500 hover:text-gray-700" (click)="closed.emit()">✕</button>
        </div>

        <div class="p-4 space-y-4">
          <div>
            <p class="text-xs font-medium text-gray-700 mb-2">Background</p>
            <div class="flex gap-2">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="exportBg" value="white" [checked]="bg === 'white'" (change)="bgChange.emit('white')" class="accent-blue-600" />
                <span class="text-xs text-gray-700">White</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="exportBg" value="black" [checked]="bg === 'black'" (change)="bgChange.emit('black')" class="accent-blue-600" />
                <span class="text-xs text-gray-700">Black</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="exportBg" value="transparent" [checked]="bg === 'transparent'" (change)="bgChange.emit('transparent')" class="accent-blue-600" />
                <span class="text-xs text-gray-700">Transparent</span>
              </label>
            </div>
          </div>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" [checked]="embed" (change)="embedChange.emit(checkedValue($event))" class="mt-0.5 accent-blue-600" />
            <div>
              <p class="text-xs font-medium text-gray-700">Embed diagram data</p>
              <p class="text-[11px] text-gray-400 mt-0.5">Allows reopening and editing in ZureMap by importing the PNG</p>
            </div>
          </label>
        </div>

        <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button class="h-9 px-3 rounded border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" (click)="closed.emit()">Cancel</button>
          <button
            class="h-9 px-4 rounded bg-blue-600 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            [disabled]="busy"
            (click)="export.emit()"
          >{{ busy ? 'Exporting…' : 'Export PNG' }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ExportDialogComponent {
  @Input({ required: true }) bg!: 'white' | 'black' | 'transparent';
  @Input({ required: true }) embed!: boolean;
  @Input({ required: true }) busy!: boolean;

  @Output() closed = new EventEmitter<void>();
  @Output() export = new EventEmitter<void>();
  @Output() bgChange = new EventEmitter<'white' | 'black' | 'transparent'>();
  @Output() embedChange = new EventEmitter<boolean>();

  checkedValue(event: Event): boolean {
    return !!(event.target as HTMLInputElement).checked;
  }
}
