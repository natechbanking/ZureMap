import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AksInfoView } from '../diagram-node-list-details.mapper';

@Component({
  selector: 'app-aks-details-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded border border-violet-200 bg-white shadow-sm overflow-hidden" (mousedown)="stop($event)" (click)="stop($event)">
      <div class="px-2 pt-1.5 pb-1 flex flex-wrap gap-1 border-b border-violet-100">
        <span class="text-[9px] font-semibold px-1.5 py-px rounded-full bg-violet-100 text-violet-700 leading-tight">k8s {{ info.kubernetesVersion }}</span>
        <span class="text-[9px] px-1.5 py-px rounded-full bg-blue-100 text-blue-700 leading-tight">{{ info.networkPlugin }}</span>
      </div>
      @if (info.nodePools.length === 0) {
        <p class="text-[10px] text-gray-400 px-2 py-1.5">No node pools found.</p>
      } @else {
        <div class="px-2 pt-1 pb-0.5">
          <p class="text-[9px] font-semibold text-violet-600 uppercase tracking-wide mb-0.5">Node Pools</p>
          @for (pool of info.nodePools; track pool.name) {
            <div class="rounded border border-violet-100 bg-violet-50/40 px-1.5 py-1 mb-1 last:mb-0">
              <div class="flex items-center gap-1 mb-0.5">
                <span class="text-[10px] font-semibold text-gray-800 truncate flex-1" [title]="pool.name">{{ pool.name }}</span>
                <span class="text-[9px] px-1 py-px rounded-full leading-tight shrink-0" [ngClass]="pool.mode === 'System' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">{{ pool.mode }}</span>
              </div>
              <p class="text-[10px] text-gray-600 truncate" [title]="pool.vmSize">{{ pool.vmSize }}</p>
              <p class="text-[10px] text-gray-500">{{ pool.count }} node{{ pool.count !== 1 ? 's' : '' }} &middot; {{ pool.osType }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AksDetailsPanelComponent {
  @Input({ required: true }) info!: AksInfoView;

  stop(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
