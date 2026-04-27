import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramStore } from '../../core/store/diagram.store';
import { AzureIconComponent } from '../../shared/components/azure-icon/azure-icon.component';
import { IconRegistryService } from '../../core/services/icon-registry.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, AzureIconComponent],
  template: `
    @if (store.selectedNode(); as node) {
      <aside class="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">

        <div class="p-4 border-b border-gray-100 flex items-start gap-3">
          <app-azure-icon [resourceType]="node.resourceType" [size]="40" />
          <div class="flex-1 min-w-0">
            <h2 class="font-semibold text-gray-900 truncate">{{ node.label }}</h2>
            <p class="text-xs text-gray-500">{{ icons.getTypeLabel(node.resourceType) }}</p>
          </div>
          <button
            (click)="store.selectNode(null)"
            class="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >✕</button>
        </div>

        <div class="p-4 space-y-4 text-sm">

          <section>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Details</h3>
            <dl class="space-y-1.5">
              <div class="flex gap-2">
                <dt class="text-gray-500 w-24 flex-shrink-0">Location</dt>
                <dd class="text-gray-900 font-mono text-xs truncate">{{ node.metadata.location }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-gray-500 w-24 flex-shrink-0">Resource Group</dt>
                <dd class="text-gray-900 font-mono text-xs truncate">{{ node.metadata.resourceGroup }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-gray-500 w-24 flex-shrink-0">Subscription</dt>
                <dd class="text-gray-900 text-xs truncate" [title]="subscriptionDisplayName(node.metadata.subscriptionId)">
                  {{ subscriptionDisplayName(node.metadata.subscriptionId) }}
                </dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-gray-500 w-24 flex-shrink-0">Status</dt>
                <dd>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                    [class.bg-green-100]="node.status === 'running'"
                    [class.text-green-700]="node.status === 'running'"
                    [class.bg-red-100]="node.status === 'failed'"
                    [class.text-red-700]="node.status === 'failed'"
                    [class.bg-gray-100]="node.status === 'stopped' || node.status === 'unknown'"
                    [class.text-gray-600]="node.status === 'stopped' || node.status === 'unknown'"
                  >{{ node.status }}</span>
                </dd>
              </div>
            </dl>
          </section>

          @if (node.costData) {
            <section>
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cost</h3>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-2xl font-bold text-gray-900">
                  {{ formatCurrency(node.costData.monthlyCostUsd, node.costData.currency) }}
                </p>
                <p class="text-xs text-gray-500 mt-1">{{ node.costData.period }}</p>
              </div>
            </section>
          }

          @if (tagKeys(node.metadata.tags).length > 0) {
            <section>
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tags</h3>
              <div class="flex flex-wrap gap-1.5">
                @for (key of tagKeys(node.metadata.tags); track key) {
                  <span class="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono">
                    {{ key }}: {{ node.metadata.tags[key] }}
                  </span>
                }
              </div>
            </section>
          }

          @if (node.driftStatus) {
            <section>
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Drift Status</h3>
              <span class="px-2 py-1 rounded text-xs font-medium"
                [class.bg-green-100]="node.driftStatus === 'matched'"
                [class.text-green-700]="node.driftStatus === 'matched'"
                [class.bg-red-100]="node.driftStatus === 'missing'"
                [class.text-red-700]="node.driftStatus === 'missing'"
                [class.bg-blue-100]="node.driftStatus === 'unplanned'"
                [class.text-blue-700]="node.driftStatus === 'unplanned'"
              >{{ node.driftStatus }}</span>
            </section>
          }

          <section class="pt-2 border-t border-gray-100 space-y-2">
            <button
              (click)="copyArmId(node.id)"
              class="w-full text-left text-xs text-azure-blue hover:underline font-mono truncate block"
            >
              Copy ARM ID
            </button>
            <a
              [href]="portalUrl(node.id)"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full text-left text-xs text-azure-blue hover:underline block"
            >
              View in Azure Portal ↗
            </a>
          </section>

        </div>
      </aside>
    }
  `,
})
export class SidebarComponent {
  store = inject(DiagramStore);
  icons = inject(IconRegistryService);

  tagKeys(tags: Record<string, string>): string[] {
    return Object.keys(tags ?? {});
  }

  copyArmId(id: string): void {
    navigator.clipboard.writeText(id);
  }

  portalUrl(armId: string): string {
    return `https://portal.azure.com/#resource${armId}/overview`;
  }

  subscriptionDisplayName(subscriptionId: string): string {
    const active = this.store.activeSubscriptions().find(s => s.subscriptionId === subscriptionId)?.name;
    if (active) return active;
    const available = this.store.availableSubscriptions().find(s => s.subscriptionId === subscriptionId)?.name;
    return available ?? subscriptionId;
  }

  formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(value);
  }
}
