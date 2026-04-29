import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VmInfoView } from '../diagram-node-list-details.mapper';

@Component({
  selector: 'app-vm-details-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded border border-emerald-200 bg-white shadow-sm overflow-hidden" role="presentation" (mousedown)="stop($event)" (click)="stop($event)" (keydown)="stop($event)">
      <div class="px-2 pt-1.5 pb-1 flex flex-wrap gap-1 border-b border-emerald-100">
        <span class="text-[9px] font-semibold px-1.5 py-px rounded-full bg-emerald-100 text-emerald-700 leading-tight truncate max-w-full" [title]="info.vmSize">{{ info.vmSize }}</span>
        <span class="text-[9px] px-1.5 py-px rounded-full leading-tight shrink-0" [ngClass]="info.osType === 'Windows' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'">{{ info.osType }}</span>
      </div>
      <div class="px-2 py-1.5 space-y-0.5">
        @if (info.imageOffer) {
          <p class="text-[10px] text-gray-700 truncate" [title]="info.imageOffer + (info.imageSku ? ' · ' + info.imageSku : '')">
            <span class="text-gray-400">Image </span>{{ info.imageOffer }}@if (info.imageSku) { <span class="text-gray-400"> · </span>{{ info.imageSku }} }
          </p>
        }
        @if (info.computerName) {
          <p class="text-[10px] text-gray-600 truncate" [title]="info.computerName"><span class="text-gray-400">Host </span>{{ info.computerName }}</p>
        }
        @if (info.adminUsername) {
          <p class="text-[10px] text-gray-600 truncate" [title]="info.adminUsername"><span class="text-gray-400">Admin </span>{{ info.adminUsername }}</p>
        }
      </div>
    </div>
  `,
})
export class VmDetailsPanelComponent {
  @Input({ required: true }) info!: VmInfoView;

  stop(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
