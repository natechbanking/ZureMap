import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetailKv } from '../diagram-node/diagram-node-format.util';

@Component({
  selector: 'app-node-detail-kv-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded bg-white shadow-sm overflow-hidden" [ngClass]="containerClass" role="presentation" (mousedown)="stop($event)" (click)="stop($event)" (keydown)="stop($event)">
      @if (loading) {
        <p class="text-[10px] text-gray-400 px-2 py-1.5 text-center">Loading...</p>
      } @else if (error) {
        <p class="text-[10px] text-red-400 px-2 py-1.5">{{ error }}</p>
      } @else if (details.length === 0) {
        <p class="text-[10px] text-gray-400 px-2 py-1.5">{{ emptyText }}</p>
      } @else {
        <div class="p-1.5">
          @for (detail of details; track detail.label + detail.value) {
            <div class="flex items-center justify-between gap-2 px-1.5 py-1 border-b last:border-b-0" [ngClass]="rowClass">
              <span class="text-[10px] text-gray-500 truncate" [title]="detail.label">{{ detail.label }}</span>
              <span class="text-[10px] font-semibold text-gray-800 shrink-0 truncate text-right" [ngClass]="valueClass" [title]="detail.value">{{ detail.value }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class NodeDetailKvPanelComponent {
  @Input({ required: true }) details: DetailKv[] = [];
  @Input({ required: true }) emptyText!: string;
  @Input({ required: true }) containerClass!: string;
  @Input({ required: true }) rowClass!: string;
  @Input() valueClass = 'max-w-[120px]';
  @Input() loading = false;
  @Input() error: string | null = null;

  stop(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
