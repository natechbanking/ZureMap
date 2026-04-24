import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-finops-insights-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="absolute top-16 z-[130] w-[320px] rounded-xl border border-amber-200 bg-white/95 backdrop-blur shadow-lg p-3"
      [style.right.px]="right"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-900">FinOps Insights</h3>
        @if (loading) {
          <span class="text-[11px] text-amber-700">Loading...</span>
        }
      </div>

      @if (error) {
        <p class="text-xs text-red-600 leading-relaxed">{{ error }}</p>
      } @else {
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="rounded-lg bg-amber-50 border border-amber-100 p-2">
            <p class="text-[10px] text-amber-700">Total</p>
            <p class="text-xs font-semibold text-amber-900">{{ totalCostText }}</p>
          </div>
          <div class="rounded-lg bg-blue-50 border border-blue-100 p-2">
            <p class="text-[10px] text-blue-700">Costed</p>
            <p class="text-xs font-semibold text-blue-900">{{ costedNodeCount }}</p>
          </div>
          <div class="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
            <p class="text-[10px] text-emerald-700">Subs</p>
            <p class="text-xs font-semibold text-emerald-900">{{ loadedSubscriptions }}</p>
          </div>
        </div>

        <div>
          <p class="text-[11px] font-semibold text-gray-700 mb-1">Top Resources</p>
          @if (topNodes.length === 0) {
            <p class="text-xs text-gray-500">No matched cost data yet.</p>
          } @else {
            <ul class="space-y-1">
              @for (n of topNodes; track n.id) {
                <li class="flex items-start justify-between gap-2 text-xs">
                  <span class="text-gray-700 truncate" [title]="n.label">{{ n.label }}</span>
                  <span class="text-gray-900 font-medium whitespace-nowrap">{{ n.costText }}</span>
                </li>
              }
            </ul>
          }
        </div>
      }
    </aside>
  `,
})
export class FinOpsInsightsPanelComponent {
  @Input({ required: true }) right!: number;
  @Input({ required: true }) loading!: boolean;
  @Input() error: string | null = null;
  @Input({ required: true }) totalCostText!: string;
  @Input({ required: true }) costedNodeCount!: number;
  @Input({ required: true }) loadedSubscriptions!: number;
  @Input({ required: true }) topNodes!: Array<{ id: string; label: string; costText: string }>;
}
