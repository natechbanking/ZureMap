import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NodeCostData } from '../../../core/models/cost-data.model';
import { getCostBorderStyle } from '../../../core/utils/cost-thresholds';
import { FormatCostPipe } from '../../pipes/format-cost.pipe';

@Component({
  selector: 'app-cost-badge',
  standalone: true,
  imports: [CommonModule, FormatCostPipe],
  template: `
    @if (costData) {
      <span
        class="absolute -top-2 -right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white leading-none"
        [style.background-color]="tierColor"
        [title]="'Cost for selected period: ' + costData.currency + ' ' + costData.monthlyCostUsd.toFixed(2)"
      >
        {{ costData.monthlyCostUsd | formatCost }}
      </span>
    }
  `,
  host: { class: 'relative' },
})
export class CostBadgeComponent {
  @Input({ required: true }) costData!: NodeCostData | undefined;

  get tierColor(): string {
    const cost = this.costData?.monthlyCostUsd ?? 0;
    return getCostBorderStyle(cost).borderColor;
  }
}
