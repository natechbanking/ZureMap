import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AzureSubscription } from '../../../core/models/azure-resource.model';

@Component({
  selector: 'app-subscription-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-2">
      <p class="text-sm text-gray-500 mb-3">Select one or more subscriptions to scan:</p>
      @for (group of groupedSubscriptions; track group.tenantId) {
        <div class="rounded-lg border border-azure-border overflow-hidden">
          <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-azure-border">
            <div class="min-w-0">
              <p class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tenant</p>
              <p class="text-xs text-gray-500 font-mono truncate">{{ group.tenantId }}</p>
            </div>
            <button
              type="button"
              class="text-xs text-azure-blue hover:underline whitespace-nowrap"
              (click)="toggleTenant(group.tenantId); $event.preventDefault()"
            >
              {{ areAllTenantSubsSelected(group.tenantId) ? 'Clear tenant' : 'Select tenant' }}
            </button>
          </div>

          <div class="p-2 space-y-2">
            @for (sub of group.subscriptions; track sub.subscriptionId) {
              <label class="flex items-center gap-3 p-3 rounded-lg border border-azure-border hover:border-azure-blue cursor-pointer transition-colors"
                [class.border-azure-blue]="isSelected(sub)"
                [class.bg-blue-50]="isSelected(sub)"
                (click)="toggle(sub); $event.preventDefault()">
                <input
                  type="checkbox"
                  [checked]="isSelected(sub)"
                  (click)="$event.stopPropagation()"
                  class="w-4 h-4 accent-azure-blue pointer-events-none"
                  readonly
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ sub.name }}</p>
                  <p class="text-xs text-gray-500 font-mono truncate">{{ sub.subscriptionId }}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full"
                  [class.bg-green-100]="sub.state === 'Enabled'"
                  [class.text-green-700]="sub.state === 'Enabled'"
                  [class.bg-gray-100]="sub.state !== 'Enabled'"
                  [class.text-gray-600]="sub.state !== 'Enabled'"
                >{{ sub.state }}</span>
              </label>
            }
          </div>
        </div>
      }
      @if (selected.length > 0) {
        <button
          (click)="confirm()"
          class="w-full mt-4 py-2.5 px-4 bg-azure-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Scan {{ selected.length }} subscription{{ selected.length > 1 ? 's' : '' }}
        </button>
      }
    </div>
  `,
})
export class SubscriptionSelectorComponent {
  @Input({ required: true }) subscriptions: AzureSubscription[] = [];
  @Output() confirmed = new EventEmitter<AzureSubscription[]>();

  selected: AzureSubscription[] = [];

  get groupedSubscriptions(): Array<{ tenantId: string; subscriptions: AzureSubscription[] }> {
    const map = new Map<string, AzureSubscription[]>();
    for (const sub of this.subscriptions) {
      const tenantId = sub.tenantId || 'unknown-tenant';
      if (!map.has(tenantId)) map.set(tenantId, []);
      map.get(tenantId)!.push(sub);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tenantId, subscriptions]) => ({
        tenantId,
        subscriptions: [...subscriptions].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }

  private subId(sub: AzureSubscription): string {
    return sub.subscriptionId || sub.id;
  }

  isSelected(sub: AzureSubscription): boolean {
    const id = this.subId(sub);
    return !!id && this.selected.some(s => this.subId(s) === id);
  }

  toggle(sub: AzureSubscription): void {
    if (this.isSelected(sub)) {
      this.selected = this.selected.filter(s => this.subId(s) !== this.subId(sub));
    } else {
      this.selected = [...this.selected, sub];
    }
  }

  areAllTenantSubsSelected(tenantId: string): boolean {
    const tenantSubs = this.subscriptions.filter(s => (s.tenantId || 'unknown-tenant') === tenantId);
    return tenantSubs.length > 0 && tenantSubs.every(s => this.isSelected(s));
  }

  toggleTenant(tenantId: string): void {
    const tenantSubs = this.subscriptions.filter(s => (s.tenantId || 'unknown-tenant') === tenantId);
    if (tenantSubs.length === 0) return;

    if (this.areAllTenantSubsSelected(tenantId)) {
      const tenantIds = new Set(tenantSubs.map(s => this.subId(s)));
      this.selected = this.selected.filter(s => !tenantIds.has(this.subId(s)));
      return;
    }

    const selectedById = new Map(this.selected.map(s => [this.subId(s), s]));
    for (const sub of tenantSubs) selectedById.set(this.subId(sub), sub);
    this.selected = Array.from(selectedById.values());
  }

  confirm(): void {
    if (this.selected.length > 0) this.confirmed.emit(this.selected);
  }
}
