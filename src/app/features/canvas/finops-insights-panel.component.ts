import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FinOpsBreakdownRow, FinOpsPeriodPreset, FinOpsTrendPoint, FinOpsV2Response } from '../../core/models/cost-data.model';

@Component({
  selector: 'app-finops-insights-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="absolute top-12 bottom-0 z-[140] w-[390px] border-l border-gray-200 bg-white/98 backdrop-blur shadow-xl flex flex-col"
      [style.right.px]="right"
    >
      <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">FinOps</h3>
          <p class="text-[11px] text-gray-500">Cost analytics drawer</p>
        </div>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          (click)="close.emit()"
        >Close</button>
      </div>

      <div class="p-4 space-y-3 border-b border-gray-100">
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="px-2 py-1.5 text-xs rounded border"
            [ngClass]="periodPreset === 'mtd' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
            (click)="periodChange.emit('mtd')"
          >MTD</button>
          <button
            type="button"
            class="px-2 py-1.5 text-xs rounded border"
            [ngClass]="periodPreset === 'last30' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
            (click)="periodChange.emit('last30')"
          >Last 30 days</button>
        </div>

        <div class="grid grid-cols-1 gap-2">
          <label class="text-[11px] text-gray-600">Subscriptions</label>
          <select
            multiple
            class="w-full text-xs border border-gray-200 rounded px-2 py-1.5 min-h-20"
            (change)="onMultiSelectChange($event, 'subscriptions')"
          >
            @for (sub of subscriptionOptions; track sub.id) {
              <option [value]="sub.id" [selected]="isSelected(selectedSubscriptionIds, sub.id)">{{ sub.label }}</option>
            }
          </select>

          <label class="text-[11px] text-gray-600">Resource Groups</label>
          <select
            multiple
            class="w-full text-xs border border-gray-200 rounded px-2 py-1.5 min-h-20"
            (change)="onMultiSelectChange($event, 'resourceGroups')"
          >
            @for (rg of resourceGroupOptions; track rg) {
              <option [value]="rg" [selected]="isSelected(selectedResourceGroups, rg)">{{ rg }}</option>
            }
          </select>

          <label class="text-[11px] text-gray-600">Resource Types</label>
          <select
            multiple
            class="w-full text-xs border border-gray-200 rounded px-2 py-1.5 min-h-20"
            (change)="onMultiSelectChange($event, 'resourceTypes')"
          >
            @for (rt of resourceTypeOptions; track rt) {
              <option [value]="rt" [selected]="isSelected(selectedResourceTypes, rt)">{{ rt }}</option>
            }
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-xs rounded bg-azure-dark text-white hover:bg-azure-blue disabled:opacity-50"
            [disabled]="loading"
            (click)="refresh.emit()"
          >{{ loading ? 'Refreshing…' : 'Load / Refresh' }}</button>
          @if (stale) {
            <span class="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">Stale</span>
          }
          @if (state === 'partial') {
            <span class="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-800">Partial</span>
          }
          @if (state === 'error') {
            <span class="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700">Error</span>
          }
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        @if (error) {
          <div class="text-xs rounded border border-red-200 bg-red-50 text-red-700 p-2">{{ error }}</div>
        }

        <div class="grid grid-cols-3 gap-2">
          <div class="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p class="text-[10px] text-amber-700">Total Cost {{ baseCurrency }}</p>
            <p class="text-xs font-semibold text-amber-900">{{ totalCostText }}</p>
          </div>
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-2">
            <p class="text-[10px] text-blue-700">Costed Resources</p>
            <p class="text-xs font-semibold text-blue-900">{{ costedNodeCount }}</p>
          </div>
          <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
            <p class="text-[10px] text-emerald-700">Subs L/F</p>
            <p class="text-xs font-semibold text-emerald-900">{{ loadedSubscriptions }}/{{ failedSubscriptions }}</p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 p-2">
          <p class="text-[11px] font-semibold text-gray-700 mb-1">Daily Trend</p>
          @if (trendPoints.length === 0) {
            <p class="text-xs text-gray-500">No trend points for this selection.</p>
          } @else {
            <svg viewBox="0 0 320 120" class="w-full h-28">
              <polyline
                fill="none"
                stroke="#0078d4"
                stroke-width="2"
                [attr.points]="trendPolyline"
              ></polyline>
            </svg>
            <div class="flex justify-between text-[10px] text-gray-500">
              <span>{{ trendStart }}</span>
              <span>{{ trendEnd }}</span>
            </div>
          }
        </div>

        <div>
          <p class="text-[11px] font-semibold text-gray-700 mb-1">Top Resources</p>
          @if (topNodes.length === 0) {
            <p class="text-xs text-gray-500">No mapped resources for current filters.</p>
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

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg border border-gray-200 p-2">
            <p class="text-[11px] font-semibold text-gray-700 mb-1">By Resource Group</p>
            @if (byResourceGroup.length === 0) {
              <p class="text-xs text-gray-500">No data.</p>
            } @else {
              @for (row of byResourceGroup; track row.key) {
                <div class="flex justify-between text-xs py-0.5">
                  <span class="truncate pr-2" [title]="row.key">{{ row.key }}</span>
                  <span class="font-medium">{{ formatValue(row.value) }}</span>
                </div>
              }
            }
          </div>
          <div class="rounded-lg border border-gray-200 p-2">
            <p class="text-[11px] font-semibold text-gray-700 mb-1">By Resource Type</p>
            @if (byResourceType.length === 0) {
              <p class="text-xs text-gray-500">No data.</p>
            } @else {
              @for (row of byResourceType; track row.key) {
                <div class="flex justify-between text-xs py-0.5">
                  <span class="truncate pr-2" [title]="row.key">{{ row.key }}</span>
                  <span class="font-medium">{{ formatValue(row.value) }}</span>
                </div>
              }
            }
          </div>
        </div>

        @if (payload) {
          <div class="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs space-y-1">
            <p class="font-semibold text-orange-900">Diagnostics</p>
            <p class="text-orange-800">Matched: {{ payload.diagnostics.matchedResourceCount }} / {{ payload.diagnostics.requestedResourceCount }}</p>
            <p class="text-orange-800">Unmatched resources: {{ payload.diagnostics.unmatchedResourceCount }}</p>
            @if (payload.diagnostics.sampleUnmatchedResourceIds.length > 0) {
              <p class="text-orange-800 break-all">Sample unmatched: {{ payload.diagnostics.sampleUnmatchedResourceIds[0] }}</p>
            }
            @if (payload.warnings.length > 0) {
              <p class="text-orange-800">Warnings: {{ payload.warnings[0] }}</p>
            }
            @if (payload.failedSubscriptionCount > 0) {
              @for (sub of payload.subscriptions; track sub.subscriptionId) {
                @if (sub.status === 'failed') {
                  <p class="text-orange-800 break-all">Failed {{ sub.subscriptionId }}: {{ sub.reason }}</p>
                }
              }
            }
          </div>
        }
      </div>
    </aside>
  `,
})
export class FinOpsInsightsPanelComponent {
  @Input({ required: true }) right!: number;
  @Input({ required: true }) loading!: boolean;
  @Input({ required: true }) stale!: boolean;
  @Input({ required: true }) state!: 'idle' | 'loading' | 'success' | 'partial' | 'error';
  @Input() error: string | null = null;
  @Input({ required: true }) payload!: FinOpsV2Response | null;

  @Input({ required: true }) periodPreset!: FinOpsPeriodPreset;
  @Input({ required: true }) baseCurrency!: string;
  @Input({ required: true }) subscriptionOptions!: { id: string; label: string }[];
  @Input({ required: true }) resourceGroupOptions!: string[];
  @Input({ required: true }) resourceTypeOptions!: string[];
  @Input({ required: true }) selectedSubscriptionIds!: string[];
  @Input({ required: true }) selectedResourceGroups!: string[];
  @Input({ required: true }) selectedResourceTypes!: string[];

  @Input({ required: true }) totalCostText!: string;
  @Input({ required: true }) costedNodeCount!: number;
  @Input({ required: true }) loadedSubscriptions!: number;
  @Input({ required: true }) failedSubscriptions!: number;
  @Input({ required: true }) topNodes!: { id: string; label: string; costText: string }[];
  @Input({ required: true }) byResourceGroup!: FinOpsBreakdownRow[];
  @Input({ required: true }) byResourceType!: FinOpsBreakdownRow[];

  @Output() closed = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() periodChange = new EventEmitter<FinOpsPeriodPreset>();
  @Output() subscriptionChange = new EventEmitter<string[]>();
  @Output() resourceGroupChange = new EventEmitter<string[]>();
  @Output() resourceTypeChange = new EventEmitter<string[]>();

  isSelected(selected: string[], value: string): boolean {
    return selected.includes(value);
  }

  onMultiSelectChange(event: Event, target: 'subscriptions' | 'resourceGroups' | 'resourceTypes'): void {
    const select = event.target as HTMLSelectElement;
    const values = [...select.selectedOptions].map(opt => opt.value);

    if (target === 'subscriptions') this.subscriptionChange.emit(values);
    if (target === 'resourceGroups') this.resourceGroupChange.emit(values);
    if (target === 'resourceTypes') this.resourceTypeChange.emit(values);
  }

  get trendPoints(): FinOpsTrendPoint[] {
    return this.payload?.trend ?? [];
  }

  get trendStart(): string {
    return this.trendPoints[0]?.date ?? '';
  }

  get trendEnd(): string {
    return this.trendPoints[this.trendPoints.length - 1]?.date ?? '';
  }

  get trendPolyline(): string {
    const points = this.trendPoints;
    if (points.length === 0) return '';
    if (points.length === 1) return '10,60 310,60';

    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    return points
      .map((p, i) => {
        const x = 10 + (300 * i) / (points.length - 1);
        const y = 110 - ((p.value - min) / span) * 90;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  formatValue(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.baseCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
