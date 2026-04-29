import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-storage-details-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded border border-teal-200 bg-white shadow-sm overflow-hidden" role="presentation" (mousedown)="stop($event)" (click)="stop($event)" (keydown)="stop($event)">
      @if (loading) {
        <p class="text-[10px] text-gray-400 px-2 py-1.5 text-center">Loading...</p>
      } @else if (error) {
        <p class="text-[10px] text-red-400 px-2 py-1.5">{{ error }}</p>
      } @else if (itemCount === 0) {
        <p class="text-[10px] text-gray-400 px-2 py-1.5">No containers, shares, tables or queues found.</p>
      } @else {
        @if (containers.length > 0) {
          <div class="px-2 pt-1.5 pb-0.5">
            <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Blob Containers</p>
            @for (name of containers; track name) {
              <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                <span class="text-[9px] text-gray-500">📦</span>
                <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
              </div>
            }
          </div>
        }
        @if (fileShares.length > 0) {
          <div class="px-2 pt-1.5 pb-0.5" [ngClass]="containers.length > 0 ? 'border-t border-teal-100' : ''">
            <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">File Shares</p>
            @for (name of fileShares; track name) {
              <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                <span class="text-[9px] text-gray-500">📁</span>
                <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
              </div>
            }
          </div>
        }
        @if (tables.length > 0) {
          <div class="px-2 pt-1.5 pb-0.5" [ngClass]="containers.length + fileShares.length > 0 ? 'border-t border-teal-100' : ''">
            <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Tables</p>
            @for (name of tables; track name) {
              <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                <span class="text-[9px] text-gray-500">📋</span>
                <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
              </div>
            }
          </div>
        }
        @if (queues.length > 0) {
          <div class="px-2 pt-1.5 pb-0.5" [ngClass]="containers.length + fileShares.length + tables.length > 0 ? 'border-t border-teal-100' : ''">
            <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Queues</p>
            @for (name of queues; track name) {
              <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                <span class="text-[9px] text-gray-500">📨</span>
                <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class StorageDetailsPanelComponent {
  @Input({ required: true }) containers: string[] = [];
  @Input({ required: true }) fileShares: string[] = [];
  @Input({ required: true }) tables: string[] = [];
  @Input({ required: true }) queues: string[] = [];
  @Input({ required: true }) itemCount = 0;
  @Input() loading = false;
  @Input() error: string | null = null;

  stop(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
