import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import { AzureIconComponent } from '../../../shared/components/azure-icon/azure-icon.component';
import { CostBadgeComponent } from '../../../shared/components/cost-badge/cost-badge.component';
import { CostService } from '../../../core/services/cost.service';
import { DiagramStore } from '../../../core/store/diagram.store';

@Component({
  selector: 'app-diagram-node',
  standalone: true,
  imports: [CommonModule, AzureIconComponent, CostBadgeComponent],
  template: `
    <div
      class="relative flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-white cursor-pointer select-none transition-all"
      [style.width.px]="node.size.width"
      [style.height.px]="node.size.height"
      [style.border]="borderStyle"
      [style.box-shadow]="boxShadow"
      [class.ring-2]="node.selected"
      [class.ring-azure-blue]="node.selected"
      [class.opacity-50]="node.driftStatus === 'missing'"
      [class.border-dashed]="node.driftStatus === 'unplanned'"
      (click)="clicked.emit(node.id)"
      (contextmenu)="onContextMenu($event)"
    >
      @if (node.isPinned) {
        <span class="absolute top-1 left-1 text-xs" title="Pinned">📌</span>
      }

      <app-azure-icon [resourceType]="node.resourceType" [size]="32" />

      <span
        class="text-[11px] font-medium text-gray-800 text-center leading-tight max-w-full px-1 break-words overflow-hidden"
        [title]="node.label"
        style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
      >
        {{ node.label }}
      </span>

      <span class="text-[10px] text-gray-400 truncate max-w-full px-1">
        {{ typeLabel }}
      </span>

      @if (finOpsActive && node.costData) {
        <app-cost-badge [costData]="node.costData" />
      }

      @if (node.driftStatus === 'missing') {
        <span class="absolute -top-2 -left-2 text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center" title="Missing in Azure">!</span>
      }
      @if (node.driftStatus === 'unplanned') {
        <span class="absolute -top-2 -left-2 text-xs bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center" title="New in Azure">+</span>
      }
    </div>
  `,
})
export class DiagramNodeComponent {
  @Input({ required: true }) node!: DiagramNode;
  @Input() finOpsActive = false;
  @Output() clicked = new EventEmitter<string>();
  @Output() pinToggled = new EventEmitter<string>();

  private costSvc = inject(CostService);

  get typeLabel(): string {
    const parts = this.node.resourceType.split('/');
    return parts[parts.length - 1];
  }

  get borderStyle(): string {
    if (this.node.driftStatus === 'missing')   return '2px solid #d13438';
    if (this.node.driftStatus === 'unplanned') return '2px dashed #0078d4';
    if (this.node.selected)                    return '2px solid #0078d4';
    if (this.finOpsActive && this.node.costData) {
      const s = this.costSvc.getCostBorderStyle(this.node.costData.monthlyCostUsd);
      return `${s.borderWidth} solid ${s.borderColor}`;
    }
    return '1px solid #d2d0ce';
  }

  get boxShadow(): string {
    if (!this.finOpsActive || !this.node.costData) return '';
    const store = inject(DiagramStore);
    const maxCost = store.totalMonthlyCost();
    return this.costSvc.getCostHeatmapGlow(this.node.costData.monthlyCostUsd, maxCost);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.pinToggled.emit(this.node.id);
  }
}
