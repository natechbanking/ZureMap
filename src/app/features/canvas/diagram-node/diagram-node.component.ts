import { Component, Input, Output, EventEmitter, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramNode, NodeInternalItem } from '../../../core/models/diagram-node.model';
import { AzureIconComponent } from '../../../shared/components/azure-icon/azure-icon.component';
import { CostBadgeComponent } from '../../../shared/components/cost-badge/cost-badge.component';
import { CostService } from '../../../core/services/cost.service';
import { DiagramStore } from '../../../core/store/diagram.store';
import { StorageDetailsService, StorageDetails } from '../../../core/services/storage-details.service';
import { UaiRoleAssignmentsService, UaiRoleAssignment } from '../../../core/services/uai-role-assignments.service';

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

export interface StorageAccountExpansionRequest {
  nodeId: string;
  expanded: boolean;
  itemCount: number;
}

export interface AksExpansionRequest {
  nodeId: string;
  expanded: boolean;
  nodePoolCount: number;
}

export interface VmExpansionRequest {
  nodeId: string;
  expanded: boolean;
}

export interface UaiExpansionRequest {
  nodeId: string;
  expanded: boolean;
  assignmentCount: number;
}

export interface HostingEnvironmentExpansionRequest {
  nodeId: string;
  expanded: boolean;
  statCount: number;
}

export interface ServerFarmExpansionRequest {
  nodeId: string;
  expanded: boolean;
  statCount: number;
}

interface AksNodePoolView {
  name: string;
  count: number;
  vmSize: string;
  mode: string;
  osType: string;
}

interface AksInfoView {
  kubernetesVersion: string;
  networkPlugin: string;
  nodePools: AksNodePoolView[];
}

interface VmInfoView {
  vmSize: string;
  osType: string;
  imageOffer: string;
  imageSku: string;
  adminUsername: string | null;
  computerName: string | null;
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

interface UaiRoleAssignmentView {
  id: string;
  roleDefinitionName: string;
  scope: string;
  principalType: string;
  description: string | null;
}

interface HostingEnvironmentStatView {
  label: string;
  value: string;
}

interface ServerFarmStatView {
  label: string;
  value: string;
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
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-[10px] leading-tight text-cyan-700 hover:bg-cyan-100"
          [title]="routesExpanded ? 'Hide routes' : 'Show routes'"
          (mousedown)="stopEvent($event)"
          (click)="toggleRoutesPanel($event)"
        >
          {{ routesExpanded ? 'Hide routes' : 'Show routes' }} ({{ routeEntries.length }})
        </button>
      }

      @if (isUserAssignedIdentity) {
        <button
          type="button"
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-sky-200 bg-sky-50 text-[10px] leading-tight text-sky-700 hover:bg-sky-100"
          [title]="uaiAssignmentsExpanded ? 'Hide role assignments' : 'Show role assignments'"
          (mousedown)="stopEvent($event)"
          (click)="toggleUaiRoleAssignmentsPanel($event)"
        >
          @if (uaiAssignmentsExpanded) {
            Hide assignments
          } @else if (!uaiAssignmentsLoaded) {
            Show assignments
          } @else {
            Show assignments ({{ uaiRoleAssignments.length }})
          }
        </button>
      }

      @if (isHostingEnvironment) {
        <button
          type="button"
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-fuchsia-200 bg-fuchsia-50 text-[10px] leading-tight text-fuchsia-700 hover:bg-fuchsia-100"
          [title]="hostingEnvironmentStatsExpanded ? 'Hide hosting environment stats' : 'Show hosting environment stats'"
          (mousedown)="stopEvent($event)"
          (click)="toggleHostingEnvironmentStatsPanel($event)"
        >
          {{ hostingEnvironmentStatsExpanded ? 'Hide stats' : 'Show stats' }} ({{ hostingEnvironmentStats.length }})
        </button>
      }

      @if (isServerFarm) {
        <button
          type="button"
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-pink-200 bg-pink-50 text-[10px] leading-tight text-pink-700 hover:bg-pink-100"
          [title]="serverFarmStatsExpanded ? 'Hide server farm stats' : 'Show server farm stats'"
          (mousedown)="stopEvent($event)"
          (click)="toggleServerFarmStatsPanel($event)"
        >
          {{ serverFarmStatsExpanded ? 'Hide stats' : 'Show stats' }} ({{ serverFarmStats.length }})
        </button>
      }

      @if (isVirtualNetwork) {
        <button
          type="button"
          data-export-hide
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
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-orange-200 bg-orange-50 text-[10px] leading-tight text-orange-700 hover:bg-orange-100"
          [title]="nsgRulesExpanded ? 'Hide rules' : 'Show rules'"
          (mousedown)="stopEvent($event)"
          (click)="toggleNsgRulesPanel($event)"
        >
          {{ nsgRulesExpanded ? 'Hide rules' : 'Show rules' }} ({{ nsgRuleEntries.length }})
        </button>
      }

      @if (isStorageAccount) {
        <button
          type="button"
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-teal-200 bg-teal-50 text-[10px] leading-tight text-teal-700 hover:bg-teal-100"
          [title]="storageDetailsExpanded ? 'Hide storage details' : 'Show storage details'"
          (mousedown)="stopEvent($event)"
          (click)="toggleStorageDetailsPanel($event)"
        >
          @if (storageDetailsExpanded) {
            Hide storage
          } @else if (!storageDetailsLoaded) {
            Show storage
          } @else {
            Show storage ({{ storageItemCount }})
          }
        </button>
      }

      @if (isAks) {
        <button
          type="button"
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-[10px] leading-tight text-violet-700 hover:bg-violet-100"
          [title]="aksExpanded ? 'Hide cluster details' : 'Show cluster details'"
          (mousedown)="stopEvent($event)"
          (click)="toggleAksPanel($event)"
        >
          {{ aksExpanded ? 'Hide cluster' : 'Show cluster' }} ({{ aksInfo.nodePools.length }} pools)
        </button>
      }

      @if (isVm) {
        <button
          type="button"
          data-export-hide
          class="mt-0.5 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[10px] leading-tight text-emerald-700 hover:bg-emerald-100"
          [title]="vmExpanded ? 'Hide VM details' : 'Show VM details'"
          (mousedown)="stopEvent($event)"
          (click)="toggleVmPanel($event)"
        >
          {{ vmExpanded ? 'Hide details' : 'Show details' }}
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
        data-export-hide
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

      @if (isUserAssignedIdentity && uaiAssignmentsExpanded) {
        <div
          class="w-full mt-1 rounded border border-sky-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (uaiAssignmentsLoading) {
            <p class="text-[10px] text-gray-400 px-2 py-1.5 text-center">Loading...</p>
          } @else if (uaiAssignmentsError) {
            <p class="text-[10px] text-red-400 px-2 py-1.5">{{ uaiAssignmentsError }}</p>
          } @else if (uaiRoleAssignments.length === 0) {
            <p class="text-[10px] text-gray-500 px-2 py-1.5">No role assignments found for this identity.</p>
          } @else {
            <div class="space-y-1 p-1.5">
              @for (assignment of uaiRoleAssignments; track assignment.id) {
                <div class="rounded border border-sky-100 bg-sky-50/40 px-1.5 py-1">
                  <div class="flex items-center gap-1 mb-0.5">
                    <p class="text-[10px] font-semibold text-gray-800 truncate flex-1" [title]="assignment.roleDefinitionName">
                      {{ assignment.roleDefinitionName }}
                    </p>
                    <span class="text-[9px] px-1.5 py-px rounded-full bg-gray-100 text-gray-600 leading-tight shrink-0">
                      {{ assignment.principalType }}
                    </span>
                  </div>
                  <p class="text-[10px] text-gray-600 break-all leading-snug" [title]="assignment.scope">
                    <span class="text-gray-400">Scope </span>{{ assignment.scope }}
                  </p>
                  @if (assignment.description) {
                    <p class="text-[10px] text-gray-500 break-all leading-snug mt-0.5" [title]="assignment.description">
                      {{ assignment.description }}
                    </p>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      @if (isHostingEnvironment && hostingEnvironmentStatsExpanded) {
        <div
          class="w-full mt-1 rounded border border-fuchsia-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (hostingEnvironmentStats.length === 0) {
            <p class="text-[10px] text-gray-500 px-2 py-1.5">No stats available for this hosting environment.</p>
          } @else {
            <div class="p-1.5">
              @for (stat of hostingEnvironmentStats; track stat.label) {
                <div class="flex items-center justify-between gap-2 px-1.5 py-1 border-b border-fuchsia-50 last:border-b-0">
                  <span class="text-[10px] text-gray-500 truncate" [title]="stat.label">{{ stat.label }}</span>
                  <span class="text-[10px] font-semibold text-gray-800 shrink-0" [title]="stat.value">{{ stat.value }}</span>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (isServerFarm && serverFarmStatsExpanded) {
        <div
          class="w-full mt-1 rounded border border-pink-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (serverFarmStats.length === 0) {
            <p class="text-[10px] text-gray-500 px-2 py-1.5">No stats available for this server farm.</p>
          } @else {
            <div class="p-1.5">
              @for (stat of serverFarmStats; track stat.label) {
                <div class="flex items-center justify-between gap-2 px-1.5 py-1 border-b border-pink-50 last:border-b-0">
                  <span class="text-[10px] text-gray-500 truncate" [title]="stat.label">{{ stat.label }}</span>
                  <span class="text-[10px] font-semibold text-gray-800 shrink-0" [title]="stat.value">{{ stat.value }}</span>
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

      @if (isStorageAccount && storageDetailsExpanded) {
        <div
          class="w-full mt-1 rounded border border-teal-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          @if (storageDetailsLoading) {
            <p class="text-[10px] text-gray-400 px-2 py-1.5 text-center">Loading...</p>
          } @else if (storageDetailsError) {
            <p class="text-[10px] text-red-400 px-2 py-1.5">{{ storageDetailsError }}</p>
          } @else if (storageItemCount === 0) {
            <p class="text-[10px] text-gray-400 px-2 py-1.5">No containers, shares, tables or queues found.</p>
          } @else {
          @if (storageContainers.length > 0) {
            <div class="px-2 pt-1.5 pb-0.5">
              <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Blob Containers</p>
              @for (name of storageContainers; track name) {
                <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                  <span class="text-[9px] text-gray-500">📦</span>
                  <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
                </div>
              }
            </div>
          }
          @if (storageFileShares.length > 0) {
            <div class="px-2 pt-1.5 pb-0.5" [ngClass]="storageContainers.length > 0 ? 'border-t border-teal-100' : ''">
              <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">File Shares</p>
              @for (name of storageFileShares; track name) {
                <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                  <span class="text-[9px] text-gray-500">📁</span>
                  <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
                </div>
              }
            </div>
          }
          @if (storageTables.length > 0) {
            <div class="px-2 pt-1.5 pb-0.5" [ngClass]="storageContainers.length + storageFileShares.length > 0 ? 'border-t border-teal-100' : ''">
              <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Tables</p>
              @for (name of storageTables; track name) {
                <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                  <span class="text-[9px] text-gray-500">📋</span>
                  <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
                </div>
              }
            </div>
          }
          @if (storageQueues.length > 0) {
            <div class="px-2 pt-1.5 pb-0.5" [ngClass]="storageContainers.length + storageFileShares.length + storageTables.length > 0 ? 'border-t border-teal-100' : ''">
              <p class="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Queues</p>
              @for (name of storageQueues; track name) {
                <div class="flex items-center gap-1 py-px border-b border-teal-50 last:border-b-0">
                  <span class="text-[9px] text-gray-500">📨</span>
                  <span class="text-[10px] text-gray-700 truncate" [title]="name">{{ name }}</span>
                </div>
              }
            </div>
          }
          }
        </div>
      }

      @if (isAks && aksExpanded) {
        <div
          class="w-full mt-1 rounded border border-violet-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          <!-- Cluster metadata row -->
          <div class="px-2 pt-1.5 pb-1 flex flex-wrap gap-1 border-b border-violet-100">
            <span class="text-[9px] font-semibold px-1.5 py-px rounded-full bg-violet-100 text-violet-700 leading-tight">
              k8s {{ aksInfo.kubernetesVersion }}
            </span>
            <span class="text-[9px] px-1.5 py-px rounded-full bg-blue-100 text-blue-700 leading-tight">
              {{ aksInfo.networkPlugin }}
            </span>
          </div>
          <!-- Node pools -->
          @if (aksInfo.nodePools.length === 0) {
            <p class="text-[10px] text-gray-400 px-2 py-1.5">No node pools found.</p>
          } @else {
            <div class="px-2 pt-1 pb-0.5">
              <p class="text-[9px] font-semibold text-violet-600 uppercase tracking-wide mb-0.5">Node Pools</p>
              @for (pool of aksInfo.nodePools; track pool.name) {
                <div class="rounded border border-violet-100 bg-violet-50/40 px-1.5 py-1 mb-1 last:mb-0">
                  <div class="flex items-center gap-1 mb-0.5">
                    <span class="text-[10px] font-semibold text-gray-800 truncate flex-1" [title]="pool.name">{{ pool.name }}</span>
                    <span
                      class="text-[9px] px-1 py-px rounded-full leading-tight shrink-0"
                      [ngClass]="pool.mode === 'System' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
                    >{{ pool.mode }}</span>
                  </div>
                  <p class="text-[10px] text-gray-600 truncate" [title]="pool.vmSize">{{ pool.vmSize }}</p>
                  <p class="text-[10px] text-gray-500">{{ pool.count }} node{{ pool.count !== 1 ? 's' : '' }} &middot; {{ pool.osType }}</p>
                </div>
              }
            </div>
          }
        </div>
      }
      @if (isVm && vmExpanded) {
        <div
          class="w-full mt-1 rounded border border-emerald-200 bg-white shadow-sm overflow-hidden"
          (mousedown)="stopEvent($event)"
          (click)="stopEvent($event)"
        >
          <!-- Size + OS row -->
          <div class="px-2 pt-1.5 pb-1 flex flex-wrap gap-1 border-b border-emerald-100">
            <span class="text-[9px] font-semibold px-1.5 py-px rounded-full bg-emerald-100 text-emerald-700 leading-tight truncate max-w-full" [title]="vmInfo.vmSize">
              {{ vmInfo.vmSize }}
            </span>
            <span
              class="text-[9px] px-1.5 py-px rounded-full leading-tight shrink-0"
              [ngClass]="vmInfo.osType === 'Windows' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'"
            >{{ vmInfo.osType }}</span>
          </div>
          <!-- Image + credentials -->
          <div class="px-2 py-1.5 space-y-0.5">
            @if (vmInfo.imageOffer) {
              <p class="text-[10px] text-gray-700 truncate" [title]="vmInfo.imageOffer + (vmInfo.imageSku ? ' · ' + vmInfo.imageSku : '')">
                <span class="text-gray-400">Image </span>{{ vmInfo.imageOffer }}@if (vmInfo.imageSku) { <span class="text-gray-400"> · </span>{{ vmInfo.imageSku }} }
              </p>
            }
            @if (vmInfo.computerName) {
              <p class="text-[10px] text-gray-600 truncate" [title]="vmInfo.computerName">
                <span class="text-gray-400">Host </span>{{ vmInfo.computerName }}
              </p>
            }
            @if (vmInfo.adminUsername) {
              <p class="text-[10px] text-gray-600 truncate" [title]="vmInfo.adminUsername">
                <span class="text-gray-400">Admin </span>{{ vmInfo.adminUsername }}
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DiagramNodeComponent {
  @Input({ required: true }) node!: DiagramNode;
  @Input() finOpsActive = false;
  @Input() zoomLevel = 1;
  @Input() tagHighlightColor: string | null = null;
  @Output() clicked = new EventEmitter<string>();
  @Output() contextMenuRequested = new EventEmitter<ContextMenuRequest>();
  @Output() editRequested = new EventEmitter<string>();
  @Output() internalItemMoved = new EventEmitter<InternalItemMoveRequest>();
  @Output() nodeResized = new EventEmitter<NodeResizeRequest>();
  @Output() routeTableExpansionChanged = new EventEmitter<RouteTableExpansionRequest>();
  @Output() virtualNetworkExpansionChanged = new EventEmitter<VirtualNetworkExpansionRequest>();
  @Output() nsgExpansionChanged = new EventEmitter<NsgExpansionRequest>();
  @Output() storageAccountExpansionChanged = new EventEmitter<StorageAccountExpansionRequest>();
  @Output() aksExpansionChanged = new EventEmitter<AksExpansionRequest>();
  @Output() vmExpansionChanged = new EventEmitter<VmExpansionRequest>();
  @Output() uaiExpansionChanged = new EventEmitter<UaiExpansionRequest>();
  @Output() hostingEnvironmentExpansionChanged = new EventEmitter<HostingEnvironmentExpansionRequest>();
  @Output() serverFarmExpansionChanged = new EventEmitter<ServerFarmExpansionRequest>();

  private costSvc = inject(CostService);
  private store = inject(DiagramStore);
  private storageDetailsSvc = inject(StorageDetailsService);
  private uaiRoleAssignmentsSvc = inject(UaiRoleAssignmentsService);
  private internalDrag: { itemId: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null = null;
  private resizeDrag: { startMouseX: number; startMouseY: number; startW: number; startH: number } | null = null;
  private _storageDetails: StorageDetails | null = null;
  routesExpanded = false;
  subnetsExpanded = false;
  nsgRulesExpanded = false;
  storageDetailsExpanded = false;
  storageDetailsLoading = false;
  storageDetailsLoaded = false;
  storageDetailsError: string | null = null;
  aksExpanded = false;
  vmExpanded = false;
  uaiAssignmentsExpanded = false;
  uaiAssignmentsLoading = false;
  uaiAssignmentsLoaded = false;
  uaiAssignmentsError: string | null = null;
  uaiRoleAssignments: UaiRoleAssignmentView[] = [];
  hostingEnvironmentStatsExpanded = false;
  serverFarmStatsExpanded = false;

  get typeLabel(): string {
    const parts = this.node.resourceType.split('/');
    return parts[parts.length - 1];
  }

  get borderStyle(): string {
    if (this.node.driftStatus === 'missing')   return '2px solid #d13438';
    if (this.node.driftStatus === 'unplanned') return '2px dashed #0078d4';
    if (this.node.selected)                    return '2px solid #0078d4';
    if (this.tagHighlightColor)                return `2px solid ${this.tagHighlightColor}`;
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

  get isStorageAccount(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.storage/storageaccounts';
  }

  get isAks(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.containerservice/managedclusters';
  }

  get aksInfo(): AksInfoView {
    const props = this.node.metadata?.properties ?? {};
    const pools = (props['agentPoolProfiles'] as Array<{
      name?: string;
      count?: number;
      vmSize?: string;
      mode?: string;
      osType?: string;
    }> | undefined) ?? [];
    const netProfile = props['networkProfile'] as { networkPlugin?: string } | undefined;
    return {
      kubernetesVersion: (props['kubernetesVersion'] as string | undefined) ?? 'Unknown',
      networkPlugin: netProfile?.networkPlugin ?? 'Unknown',
      nodePools: pools.map(p => ({
        name: p.name ?? 'unnamed',
        count: p.count ?? 0,
        vmSize: p.vmSize ?? 'Unknown',
        mode: p.mode ?? 'User',
        osType: p.osType ?? 'Linux',
      })),
    };
  }

  get isVm(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.compute/virtualmachines';
  }

  get isUserAssignedIdentity(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.managedidentity/userassignedidentities';
  }

  get isHostingEnvironment(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.web/hostingenvironments';
  }

  get isServerFarm(): boolean {
    return this.node.resourceType.toLowerCase() === 'microsoft.web/serverfarms';
  }

  get hostingEnvironmentStats(): HostingEnvironmentStatView[] {
    const props = this.node.metadata?.properties ?? {};
    const workerPools = (props['workerPools'] as Array<{
      workerCount?: number | string;
      instanceCount?: number | string;
      numberOfWorkers?: number | string;
    }> | undefined) ?? [];

    const totalWorkers = workerPools.reduce((sum, pool) => {
      const workers = this.toNumber(pool.workerCount) ??
        this.toNumber(pool.instanceCount) ??
        this.toNumber(pool.numberOfWorkers) ??
        0;
      return sum + workers;
    }, 0);

    const stats: HostingEnvironmentStatView[] = [
      { label: 'Worker Pools', value: workerPools.length.toString() },
      { label: 'Worker Instances', value: totalWorkers.toString() },
      this.toStat('Front-End Scale', this.toNumber(props['frontEndScaleFactor'])),
      this.toStat('Dedicated Hosts', this.toNumber(props['dedicatedHostCount'])),
      this.toStat('Cluster Settings', this.toArrayCount(props['clusterSettings'])),
      this.toStat('Outbound IPs', this.toCsvCount(props['outboundIpAddresses'])),
      this.toStat('IP SSL Addresses', this.toNumber(props['ipsslAddressCount'])),
      this.toStat('Internal LB Modes', this.toCsvCount(props['internalLoadBalancingMode'])),
    ].filter((s): s is HostingEnvironmentStatView => !!s);

    return stats;
  }

  get serverFarmStats(): ServerFarmStatView[] {
    const props = this.node.metadata?.properties ?? {};
    const sku = this.node.metadata?.sku;

    const stats: ServerFarmStatView[] = [
      this.toTextStat('SKU', sku?.name ?? null),
      this.toTextStat('Tier', sku?.tier ?? null),
      this.toStat('Capacity', this.toNumber(sku?.capacity)),
      this.toStat('Workers', this.toNumber(props['numberOfWorkers'])),
      this.toStat('Sites', this.toNumber(props['numberOfSites'])),
      this.toStat('Maximum Elastic Workers', this.toNumber(props['maximumElasticWorkerCount'])),
      this.toTextStat('Zone Redundant', this.toBoolText(props['zoneRedundant'])),
      this.toTextStat('Reserved (Linux)', this.toBoolText(props['reserved'])),
      this.toTextStat('Hyper-V', this.toBoolText(props['hyperV'])),
      this.toTextStat('Per-Site Scaling', this.toBoolText(props['perSiteScaling'])),
    ].filter((s): s is ServerFarmStatView => !!s);

    return stats;
  }

  get vmInfo(): VmInfoView {
    const props = this.node.metadata?.properties ?? {};
    const hw = props['hardwareProfile'] as { vmSize?: string } | undefined;
    const storage = props['storageProfile'] as {
      osDisk?: { osType?: string };
      imageReference?: { offer?: string; sku?: string; publisher?: string };
    } | undefined;
    const os = props['osProfile'] as { computerName?: string; adminUsername?: string } | undefined;
    return {
      vmSize: hw?.vmSize ?? 'Unknown',
      osType: storage?.osDisk?.osType ?? 'Unknown',
      imageOffer: storage?.imageReference?.offer ?? '',
      imageSku: storage?.imageReference?.sku ?? '',
      adminUsername: os?.adminUsername ?? null,
      computerName: os?.computerName ?? null,
    };
  }

  get storageContainers(): string[] {
    return this._storageDetails?.containers ?? [];
  }

  get storageFileShares(): string[] {
    return this._storageDetails?.fileShares ?? [];
  }

  get storageTables(): string[] {
    return this._storageDetails?.tables ?? [];
  }

  get storageQueues(): string[] {
    return this._storageDetails?.queues ?? [];
  }

  get storageItemCount(): number {
    return this.storageContainers.length + this.storageFileShares.length +
           this.storageTables.length + this.storageQueues.length;
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

  toggleStorageDetailsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.storageDetailsExpanded = !this.storageDetailsExpanded;

    if (this.storageDetailsExpanded && !this.storageDetailsLoaded && !this.storageDetailsLoading) {
      this.storageDetailsLoading = true;
      this.storageDetailsError = null;
      // Emit preliminary expand so canvas resizes the node while loading
      this.storageAccountExpansionChanged.emit({ nodeId: this.node.id, expanded: true, itemCount: 3 });

      const resourceId = (this.node.metadata?.id as string | undefined) ?? this.node.id;
      this.storageDetailsSvc.getDetails(resourceId)
        .then(details => {
          this._storageDetails = details;
          this.storageDetailsLoaded = true;
          this.storageDetailsLoading = false;
          this.storageAccountExpansionChanged.emit({
            nodeId: this.node.id, expanded: true, itemCount: this.storageItemCount,
          });
        })
        .catch(err => {
          this.storageDetailsLoading = false;
          this.storageDetailsError = 'Failed to load storage details';
          console.warn('[ZureMap] Storage details fetch failed:', err);
        });
    } else {
      this.storageAccountExpansionChanged.emit({
        nodeId: this.node.id,
        expanded: this.storageDetailsExpanded,
        itemCount: this.storageItemCount,
      });
    }
  }

  async toggleUaiRoleAssignmentsPanel(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.uaiAssignmentsExpanded = !this.uaiAssignmentsExpanded;

    if (this.uaiAssignmentsExpanded && !this.uaiAssignmentsLoaded && !this.uaiAssignmentsLoading) {
      const principalId = (this.node.metadata?.properties?.['principalId'] as string | undefined)?.trim();
      const subscriptionId = this.node.metadata?.subscriptionId?.trim();
      if (!principalId || !subscriptionId) {
        this.uaiAssignmentsError = 'Principal or subscription metadata is missing.';
        this.uaiExpansionChanged.emit({
          nodeId: this.node.id,
          expanded: true,
          assignmentCount: 0,
        });
        return;
      }

      this.uaiAssignmentsLoading = true;
      this.uaiAssignmentsError = null;
      this.uaiExpansionChanged.emit({ nodeId: this.node.id, expanded: true, assignmentCount: 2 });

      try {
        const assignments = await this.uaiRoleAssignmentsSvc.getAssignments(principalId, subscriptionId);
        this.uaiRoleAssignments = assignments.map(this.toUaiRoleAssignmentView);
        this.uaiAssignmentsLoaded = true;
        this.uaiAssignmentsLoading = false;
        this.uaiExpansionChanged.emit({
          nodeId: this.node.id,
          expanded: true,
          assignmentCount: this.uaiRoleAssignments.length,
        });
      } catch (err) {
        this.uaiAssignmentsLoading = false;
        this.uaiAssignmentsError = 'Failed to load role assignments';
        console.warn('[ZureMap] UAI role assignment fetch failed:', err);
      }
      return;
    }

    this.uaiExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.uaiAssignmentsExpanded,
      assignmentCount: this.uaiRoleAssignments.length,
    });
  }

  toggleHostingEnvironmentStatsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.hostingEnvironmentStatsExpanded = !this.hostingEnvironmentStatsExpanded;
    this.hostingEnvironmentExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.hostingEnvironmentStatsExpanded,
      statCount: this.hostingEnvironmentStats.length,
    });
  }

  toggleServerFarmStatsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.serverFarmStatsExpanded = !this.serverFarmStatsExpanded;
    this.serverFarmExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.serverFarmStatsExpanded,
      statCount: this.serverFarmStats.length,
    });
  }

  toggleVmPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.vmExpanded = !this.vmExpanded;
    this.vmExpansionChanged.emit({ nodeId: this.node.id, expanded: this.vmExpanded });
  }

  toggleAksPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicked.emit(this.node.id);
    this.aksExpanded = !this.aksExpanded;
    this.aksExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.aksExpanded,
      nodePoolCount: this.aksInfo.nodePools.length,
    });
  }

  private toUaiRoleAssignmentView(assignment: UaiRoleAssignment): UaiRoleAssignmentView {
    return {
      id: assignment.id,
      roleDefinitionName: assignment.roleDefinitionName || 'Unknown role',
      scope: assignment.scope || 'Unknown scope',
      principalType: assignment.principalType || 'Principal',
      description: assignment.description ?? null,
    };
  }

  private toStat(label: string, value: number | null): HostingEnvironmentStatView | null {
    if (value === null) return null;
    return { label, value: value.toString() };
  }

  private toTextStat(label: string, value: string | null): ServerFarmStatView | null {
    if (!value) return null;
    return { label, value };
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
    }
    return null;
  }

  private toArrayCount(value: unknown): number | null {
    return Array.isArray(value) ? value.length : null;
  }

  private toCsvCount(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    return trimmed.split(',').map(v => v.trim()).filter(Boolean).length;
  }

  private toBoolText(value: unknown): string | null {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return null;
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
