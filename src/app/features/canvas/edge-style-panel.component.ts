import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DiagramEdge } from '../../core/models/diagram-edge.model';

@Component({
  selector: 'app-edge-style-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="absolute top-[220px] z-[130] w-[320px] rounded-xl border border-blue-200 bg-white/95 backdrop-blur shadow-lg p-3"
      [style.right.px]="right"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-900">Connection Style</h3>
        <button class="text-xs text-gray-500 hover:text-gray-700" (click)="close.emit()">Close</button>
      </div>
      <p class="text-[11px] text-gray-500 mb-3">Type: <span class="font-medium text-gray-700">{{ edge.edgeType }}</span></p>

      <div class="grid grid-cols-2 gap-2 mb-2">
        <label class="text-[11px] text-gray-600">
          Color
          <input
            type="color"
            class="mt-1 w-full h-8 rounded border border-gray-200"
            [value]="edge.style.strokeColor"
            (input)="strokeColorChange.emit(colorValue($event))"
          />
        </label>
        <label class="text-[11px] text-gray-600">
          Width
          <select
            class="mt-1 w-full h-8 rounded border border-gray-200 px-1 text-xs"
            [value]="edge.style.strokeWidth"
            (change)="strokeWidthChange.emit(numberValue($event))"
          >
            <option [value]="1">1 px</option>
            <option [value]="1.5">1.5 px</option>
            <option [value]="2">2 px</option>
            <option [value]="3">3 px</option>
            <option [value]="4">4 px</option>
          </select>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-2">
        <label class="text-[11px] text-gray-600">
          Line Style
          <select
            class="mt-1 w-full h-8 rounded border border-gray-200 px-1 text-xs"
            [value]="dashStyle"
            (change)="dashStyleChange.emit(selectValue($event))"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
        <label class="text-[11px] text-gray-600">
          Arrowhead
          <select
            class="mt-1 w-full h-8 rounded border border-gray-200 px-1 text-xs"
            [value]="edge.style.markerEnd"
            (change)="markerChange.emit(selectValue($event))"
          >
            <option value="arrow">Arrow</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <label class="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" [checked]="edge.animated" (change)="animatedChange.emit(checkedValue($event))" />
          Animated
        </label>
        <button
          class="h-8 rounded border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          (click)="reset.emit()"
        >
          Reset To Default
        </button>
      </div>
    </aside>
  `,
})
export class EdgeStylePanelComponent {
  @Input({ required: true }) edge!: DiagramEdge;
  @Input({ required: true }) right!: number;
  @Input({ required: true }) dashStyle!: string;

  @Output() closed = new EventEmitter<void>();
  @Output() strokeColorChange = new EventEmitter<string>();
  @Output() strokeWidthChange = new EventEmitter<number>();
  @Output() dashStyleChange = new EventEmitter<string>();
  @Output() markerChange = new EventEmitter<string>();
  @Output() animatedChange = new EventEmitter<boolean>();
  @Output() styleReset = new EventEmitter<void>();

  colorValue(event: Event): string {
    return (event.target as HTMLInputElement).value || '#605e5c';
  }

  numberValue(event: Event): number {
    return Number((event.target as HTMLInputElement | HTMLSelectElement).value || 1);
  }

  selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  checkedValue(event: Event): boolean {
    return !!(event.target as HTMLInputElement).checked;
  }
}
