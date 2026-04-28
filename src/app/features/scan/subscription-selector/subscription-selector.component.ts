import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AzureSubscription } from '../../../core/models/azure-resource.model';

@Component({
  selector: 'app-subscription-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-gray-900 mb-1">Select Subscriptions</h2>
          <p class="text-sm text-gray-500">Choose the environments you want to map.</p>
        </div>
        <div class="relative">
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            placeholder="Search subscriptions..."
            class="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-azure-blue focus:border-transparent outline-none w-64"
          />
        </div>
      </div>

      @if (groupedSubscriptions.length === 0) {
        <div class="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <p class="text-gray-500 text-sm">No subscriptions match your search.</p>
        </div>
      }

      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        @for (group of groupedSubscriptions; track group.tenantId) {
          <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div class="min-w-0">
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Tenant</p>
                <p class="text-sm font-semibold text-gray-800 truncate" [title]="group.tenantId">
                  {{ group.tenantName || group.tenantId }}
                </p>
              </div>
              <button
                type="button"
                class="text-xs font-medium text-azure-blue hover:text-blue-800 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                (click)="toggleTenant(group.tenantId); $event.preventDefault()"
              >
                {{ areAllTenantSubsSelected(group.tenantId) ? 'Deselect All' : 'Select All' }}
              </button>
            </div>

            <div class="p-3 space-y-2">
              @for (sub of group.subscriptions; track sub.subscriptionId) {
                <div class="flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-blue-300"
                  [ngClass]="isSelected(sub) ? 'border-azure-blue bg-blue-50' : 'border-gray-200'"
                  (click)="toggle(sub); $event.preventDefault()">
                  
                  <div class="flex items-center justify-center w-5 h-5 rounded border flex-shrink-0 transition-colors"
                    [ngClass]="isSelected(sub) ? 'border-azure-blue bg-azure-blue' : 'border-gray-300'">
                    @if (isSelected(sub)) {
                      <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                      </svg>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-900 truncate">{{ sub.name }}</p>
                    <p class="text-[11px] text-gray-500 font-mono truncate mt-0.5">{{ sub.subscriptionId }}</p>
                  </div>
                  
                  <span class="text-[10px] font-medium px-2 py-1 rounded-md"
                    [ngClass]="sub.state === 'Enabled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                  >{{ sub.state }}</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <div class="pt-4 border-t border-gray-100 flex items-center justify-between">
        <p class="text-sm text-gray-500">
          <span class="font-semibold text-gray-900">{{ selected.length }}</span> selected
        </p>
        <button
          (click)="confirm()"
          [disabled]="selected.length === 0"
          class="py-2.5 px-6 bg-azure-blue text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          [ngClass]="selected.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'"
        >
          <span>Continue</span>
        </button>
      </div>
    </div>
  `
})
export class SubscriptionSelectorComponent {
  @Input({ required: true }) subscriptions: AzureSubscription[] = [];
  @Output() confirmed = new EventEmitter<AzureSubscription[]>();

  selected: AzureSubscription[] = [];
  searchQuery = '';

  get groupedSubscriptions(): { tenantId: string; tenantName?: string; subscriptions: AzureSubscription[] }[] {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.subscriptions.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.subscriptionId && s.subscriptionId.toLowerCase().includes(q)) ||
      (s.tenantName && s.tenantName.toLowerCase().includes(q))
    );

    const map = new Map<string, AzureSubscription[]>();
    const tenantNames = new Map<string, string>();
    
    for (const sub of filtered) {
      const tenantId = sub.tenantId || 'unknown-tenant';
      if (!map.has(tenantId)) map.set(tenantId, []);
      map.get(tenantId)!.push(sub);
      if (sub.tenantName && !tenantNames.has(tenantId)) {
        tenantNames.set(tenantId, sub.tenantName);
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tenantId, subscriptions]) => ({
        tenantId,
        tenantName: tenantNames.get(tenantId),
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
    const group = this.groupedSubscriptions.find(g => g.tenantId === tenantId);
    if (!group || group.subscriptions.length === 0) return false;
    return group.subscriptions.every(s => this.isSelected(s));
  }

  toggleTenant(tenantId: string): void {
    const group = this.groupedSubscriptions.find(g => g.tenantId === tenantId);
    if (!group) return;
    const tenantSubs = group.subscriptions;

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