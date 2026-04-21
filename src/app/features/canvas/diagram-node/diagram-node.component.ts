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

export interface RouteTableExpansionRequest {
  nodeId: string;
  expanded: boolean;
  routeCount: number;
}

export interface VirtualNetworkExpansionRequest {
  nodeId: string;
  expanded: boolean;
  subnetCount: number;
}

export interface NsgExpansionRequest {
  nodeId: string;
  expanded: boolean;
  ruleCount: number;
}

interface RouteEntryView {
  name: string;
  addressPrefix: string;
  nextHopType: string;
  nextHopIpAddress: string | null;
}

interface SubnetEntryView {
  name: string;
  addressPrefix: string;
}

interface NsgRuleView {
  name: string;
  direction: string;
  priority: number;
  access: string;
  protocol: string;
  sourceAddressPrefix: string;
  destinationPortRange: string;
  isDefault: boolean;
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

      @if (isRouteTable) {
        <button
          type="button"
          class="mt-0.5 px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-[10px] leading-tight text-cyan-700 hover:bg-cyan-100"
          [title]="routesExpanded ? 'Hide routes' : 'Show routes'"
          (mousedown)="stopEvent($event)"
          (click)="toggleRoutesPanel($event)"
        >
          {{ routesExpanded ? 'Hide routes' : 'Show routes' }} ({{ routeEntries.length }})
        </button>
      }

      @if (isVirtualNetwork) {
        <button
          type="button"
          class="mt-0.5 px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-[10px] leading-tight text-indigo-700 hover:bg-indigo-100"
          [title]="subnetsExpanded ? 'Hide subnets' : 'Show subnets'"
          (mousedown)="stopEvent($event)"
          (click)="toggleSubnetsPanel($event)"
        >
          {{ subnetsExpanded ? 'Hide subnets' : 'Show subnets' }} ({{ subnetEntries.length }})
        </button>
      }

      @if (isNsg) {
        <button
          type="button"
          class="mt-0.5 px-2 py-0.5 rounded border border-orange-200 bg-orange-50 text-[10px] leading-tight text-orange-700 hover:bg-orange-100"
          [title]="nsgRulesExpanded ? 'Hide rules' : 'Show rules'"
          (mousedown)="stopEvent($event)"
          (click)="toggleNsgRulesPanel($event)"
        >
          {{ nsgRulesExpanded ? 'Hide rules' : 'Show rules' }} ({{ nsgRuleEntries.length }})
        </button>
      }

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

      @if (isRouteTable && routesExpanded) {
        <div
          class="w-full mt-1 rounded border border-cyan-200 bg-white shadow-sm p-1.5"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (routeEntries.length === 0) {
            <p class="text-[10px] text-gray-500 px-1 py-0.5">No routes found on this table.</p>
          } @else {
            <div class="space-y-1">
              @for (route of routeEntries; track route.name + route.addressPrefix + route.nextHopType) {
                <div class="rounded border border-cyan-100 bg-cyan-50/40 px-1.5 py-1">
                  <p class="text-[10px] font-semibold text-gray-800 truncate" [title]="route.name">{{ route.name }}</p>
                  <p class="text-[10px] text-gray-600 truncate" [title]="route.addressPrefix">{{ route.addressPrefix }}</p>
                  <p class="text-[10px] text-gray-500 truncate" [title]="route.nextHopType + (route.nextHopIpAddress ? ' • ' + route.nextHopIpAddress : '')">
                    {{ route.nextHopType }}{{ route.nextHopIpAddress ? ' • ' + route.nextHopIpAddress : '' }}
                  </p>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (isVirtualNetwork && subnetsExpanded) {
        <div
          class="w-full mt-1 rounded border border-indigo-200 bg-white shadow-sm p-1.5"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (subnetEntries.length === 0) {
            <p class="text-[10px] text-gray-500 px-1 py-0.5">No subnets found on this virtual network.</p>
          } @else {
            <div class="space-y-1">
              @for (subnet of subnetEntries; track subnet.name + subnet.addressPrefix) {
                <div class="rounded border border-indigo-100 bg-indigo-50/40 px-1.5 py-1">
                  <p class="text-[10px] font-semibold text-gray-800 truncate" [title]="subnet.name">{{ subnet.name }}</p>
                  <p class="text-[10px] text-gray-600 truncate" [title]="subnet.addressPrefix">{{ subnet.addressPrefix }}</p>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (isNsg && nsgRulesExpanded) {
        <div
          class="w-full mt-1 rounded border border-orange-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (nsgRuleEntries.length === 0) {
            <p class="text-[10px] text-gray-500 px-2 py-1.5">No security rules found.</p>
          } @else {
            @for (rule of nsgRuleEntries; track rule.name + rule.priority) {
              <div
                class="px-2 py-1.5 border-b last:border-b-0"
                [ngClass]="rule.isDefault ? 'border-gray-100 bg-gray-50' : 'border-orange-50 bg-white'"
              >
                <div class="flex items-center gap-1 flex-wrap mb-0.5">
                  <span
                    class="text-[9px] font-semibold px-1.5 py-px rounded-full leading-tight shrink-0"
                    [ngClass]="rule.access === 'Allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  >{{ rule.access }}</span>
                  <span
                    class="text-[9px] px-1.5 py-px rounded-full leading-tight shrink-0"
                    [ngClass]="rule.direction === 'Inbound' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
                  >{{ rule.direction }}</span>
                  <span class="text-[9px] text-gray-400 ml-auto shrink-0">#{{ rule.priority }}</span>
                </div>
                <p class="text-[10px] font-medium text-gray-800 break-all leading-snug" [title]="rule.name">{{ rule.name }}</p>
                <div class="mt-0.5 space-y-px">
                  <p class="text-[9px] text-gray-500 break-all leading-snug">
                    <span class="text-gray-400">From </span>{{ rule.sourceAddressPrefix }}
                  </p>
                  <p class="text-[9px] text-gray-500 leading-snug">
                    <span class="text-gray-400">Port </span>{{ rule.destinationPortRange }}
                    <span class="text-gray-400"> ({{ rule.protocol }})</span>
                  </p>
                </div>
              </div>
            }
          }
        </div>
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
  @Output() routeTableExpansionChanged = new EventEmitter<RouteTableExpansionRequest>();
  @Output() virtualNetworkExpansionChanged = new EventEmitter<VirtualNetworkExpansionRequest>();
  @Output() nsgExpansionChanged = new EventEmitter<NsgExpansionRequest>();

  private costSvc = inject(CostService);
  private store = inject(DiagramStore);
  private internalDrag: { itemId: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null = null;
  private resizeDrag: { startMouseX: number; startMouseY: number; startW: number; startH: number } | null = null;
  routesExpanded = false;
  subnetsExpanded = false;
  nsgRulesExpanded = false;

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

  get isRouteTable(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.network/routetables';
  }

  get isVirtualNetwork(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.network/virtualnetworks';
  }

  get isNsg(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.network/networksecuritygroups';
  }

  get routeEntries(): RouteEntryView[] {
    const routes = (this.node.metadata?.properties?.['routes'] as unknown[] | undefined) ?? [];
    const entries: RouteEntryView[] = [];
    for (const raw of routes) {
      const route = raw as {
        name?: string;
        properties?: { addressPrefix?: string; nextHopType?: string; nextHopIpAddress?: string };
      };
      entries.push({
        name: route.name ?? 'Unnamed route',
        addressPrefix: route.properties?.addressPrefix ?? 'N/A',
        nextHopType: route.properties?.nextHopType ?? 'Unknown',
        nextHopIpAddress: route.properties?.nextHopIpAddress ?? null,
      });
    }
    return entries;
  }

  get subnetEntries(): SubnetEntryView[] {
    const subnets = (this.node.metadata?.properties?.['subnets'] as unknown[] | undefined) ?? [];
    const entries: SubnetEntryView[] = [];
    for (const raw of subnets) {
      const subnet = raw as {
        name?: string;
        properties?: { addressPrefix?: string };
      };
      entries.push({
        name: subnet.name ?? 'Unnamed subnet',
        addressPrefix: subnet.properties?.addressPrefix ?? 'N/A',
      });
    }
    return entries;
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

  toggleRoutesPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.routesExpanded = !this.routesExpanded;
    this.routeTableExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.routesExpanded,
      routeCount: this.routeEntries.length,
    });
  }

  toggleSubnetsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.subnetsExpanded = !this.subnetsExpanded;
    this.virtualNetworkExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.subnetsExpanded,
      subnetCount: this.subnetEntries.length,
    });
  }

  get nsgRuleEntries(): NsgRuleView[] {
    const userRules = (this.node.metadata?.properties?.['securityRules'] as unknown[] | undefined) ?? [];
    const defaultRules = (this.node.metadata?.properties?.['defaultSecurityRules'] as unknown[] | undefined) ?? [];
    const toView = (raw: unknown, isDefault: boolean): NsgRuleView => {
      const rule = raw as {
        name?: string;
        properties?: {
          direction?: string;
          priority?: number;
          access?: string;
          protocol?: string;
          sourceAddressPrefix?: string;
          destinationPortRange?: string;
        };
      };
      return {
        name: rule.name ?? 'Unnamed rule',
        direction: rule.properties?.direction ?? 'Inbound',
        priority: rule.properties?.priority ?? 0,
        access: rule.properties?.access ?? 'Allow',
        protocol: rule.properties?.protocol ?? '*',
        sourceAddressPrefix: rule.properties?.sourceAddressPrefix ?? '*',
        destinationPortRange: rule.properties?.destinationPortRange ?? '*',
        isDefault,
      };
    };
    const entries = [
      ...userRules.map(r => toView(r, false)),
      ...defaultRules.map(r => toView(r, true)),
    ];
    return entries.sort((a, b) => a.priority - b.priority);
  }

  toggleNsgRulesPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.nsgRulesExpanded = !this.nsgRulesExpanded;
    this.nsgExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.nsgRulesExpanded,
      ruleCount: this.nsgRuleEntries.length,
    });
  }

  stopEvent(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
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
