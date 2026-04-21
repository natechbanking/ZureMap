import { Component, Input, Output, EventEmitter, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramNode, NodeInternalItem } from '../../../core/models/diagram-node.model';
import { AzureIconComponent } from '../../../shared/components/azure-icon/azure-icon.component';
import { CostBadgeComponent } from '../../../shared/components/cost-badge/cost-badge.component';
import { CostService } from '../../../core/services/cost.service';
import { DiagramStore } from '../../../core/store/diagram.store';

export interface ContextMenuRequest {
  nodeId: string;
  x: number;
  y: number;
}

export interface InternalItemMoveRequest {
  nodeId: string;
  itemId: string;
  x: number;
  y: number;
}

export interface NodeResizeRequest {
  nodeId: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-diagram-node',
  standalone: true,
  imports: [CommonModule, AzureIconComponent, CostBadgeComponent],
  template: `
    <div
      class="relative flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg bg-white cursor-pointer select-none transition-all"
      [style.width.px]="node.size.width"
      [style.height.px]="node.size.height"
      [style.border]="borderStyle"
      [style.box-shadow]="boxShadow"
      [class.ring-2]="node.selected"
      [class.ring-azure-blue]="node.selected"
      [class.opacity-50]="node.driftStatus === 'missing'"
      [class.border-dashed]="node.driftStatus === 'unplanned'"
      (click)="clicked.emit(node.id)"
      (dblclick)="onDoubleClick($event)"
      (contextmenu)="onContextMenu($event)"
    >
      <app-azure-icon [resourceType]="node.resourceType" [size]="28" />

      <span
        class="text-[11px] font-medium text-gray-800 text-center leading-tight max-w-full px-1 break-words overflow-hidden"
        [title]="node.label"
        style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
      >
        {{ node.label }}
      </span>

      <span class="text-[10px] leading-tight text-gray-400 truncate max-w-full px-1" [title]="typeLabel">
        {{ typeLabel }}
      </span>

      @if (node.custom?.description) {
        <span class="text-[10px] leading-tight text-gray-500 text-center max-w-full px-1 truncate" [title]="node.custom?.description">
          {{ node.custom?.description }}
        </span>
      }

      @for (item of node.custom?.internalItems ?? []; track item.id) {
        <div
          class="absolute px-1 py-0.5 text-[10px] rounded bg-blue-50/90 border border-blue-200 text-blue-700 shadow-sm cursor-move max-w-[90px] truncate"
          [style.left.px]="item.x"
          [style.top.px]="item.y"
          [title]="item.text"
          (mousedown)="onInternalItemMouseDown($event, item)"
        >
          {{ item.text }}
        </div>
      }

      <button
        type="button"
        class="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-sm border border-gray-300 bg-white shadow-sm cursor-se-resize hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center"
        title="Resize resource"
        (mousedown)="onResizeMouseDown($event)"
      >
        <svg viewBox="0 0 16 16" class="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
          <path d="M6 10 L10 6" />
          <path d="M8 12 L12 8" />
          <path d="M10 14 L14 10" />
        </svg>
      </button>

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
  @Input() zoomLevel = 1;
  @Output() clicked = new EventEmitter<string>();
  @Output() contextMenuRequested = new EventEmitter<ContextMenuRequest>();
  @Output() editRequested = new EventEmitter<string>();
  @Output() internalItemMoved = new EventEmitter<InternalItemMoveRequest>();
  @Output() nodeResized = new EventEmitter<NodeResizeRequest>();

  private costSvc = inject(CostService);
  private store = inject(DiagramStore);
  private internalDrag: { itemId: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null = null;
  private resizeDrag: { startMouseX: number; startMouseY: number; startW: number; startH: number } | null = null;

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
    const maxCost = this.store.totalMonthlyCost();
    return this.costSvc.getCostHeatmapGlow(this.node.costData.monthlyCostUsd, maxCost);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuRequested.emit({ nodeId: this.node.id, x: event.clientX, y: event.clientY });
  }

  onDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.editRequested.emit(this.node.id);
  }

  onInternalItemMouseDown(event: MouseEvent, item: NodeInternalItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.internalDrag = {
      itemId: item.id,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: item.x,
      startY: item.y,
    };
  }

  onResizeMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeDrag = {
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startW: this.node.size.width,
      startH: this.node.size.height,
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent): void {
    if (this.resizeDrag) {
      const scale = Math.max(0.1, this.zoomLevel || 1);
      const dx = (event.clientX - this.resizeDrag.startMouseX) / scale;
      const dy = (event.clientY - this.resizeDrag.startMouseY) / scale;
      const width = Math.max(100, Math.min(1200, Math.round(this.resizeDrag.startW + dx)));
      const height = Math.max(70, Math.min(1200, Math.round(this.resizeDrag.startH + dy)));
      this.nodeResized.emit({ nodeId: this.node.id, width, height });
      return;
    }
    if (!this.internalDrag) return;
    const scale = Math.max(0.1, this.zoomLevel || 1);
    const dx = (event.clientX - this.internalDrag.startMouseX) / scale;
    const dy = (event.clientY - this.internalDrag.startMouseY) / scale;
    const x = Math.max(2, Math.min(this.node.size.width - 24, this.internalDrag.startX + dx));
    const y = Math.max(2, Math.min(this.node.size.height - 20, this.internalDrag.startY + dy));
    this.internalItemMoved.emit({ nodeId: this.node.id, itemId: this.internalDrag.itemId, x, y });
  }

  @HostListener('document:mouseup')
  onDocMouseUp(): void {
    this.internalDrag = null;
    this.resizeDrag = null;
  }
}
