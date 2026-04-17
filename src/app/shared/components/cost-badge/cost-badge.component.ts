import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NodeCostData } from '../../../core/models/cost-data.model';

@Component({
  selector: 'app-cost-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (costData) {
      <span
        class="absolute -top-2 -right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white leading-none"
        [style.background-color]="tierColor"
        [title]="'Monthly cost: ' + costData.currency + costData.monthlyCostUsd.toFixed(2)"
      >
        {{ formatCost(costData.monthlyCostUsd) }}
      </span>
    }
  `,
  host: { class: 'relative' },
})
export class CostBadgeComponent {
  @Input({ required: true }) costData!: NodeCostData | undefined;

  get tierColor(): string {
    const cost = this.costData?.monthlyCostUsd ?? 0;
    if (cost < 10)  return '#107c10';
    if (cost < 50)  return '#ffb900';
    if (cost < 200) return '#ca5010';
    return '#d13438';
  }

  formatCost(usd: number): string {
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
    if (usd >= 100)  return `$${Math.round(usd)}`;
    return `$${usd.toFixed(0)}`;
  }
}
