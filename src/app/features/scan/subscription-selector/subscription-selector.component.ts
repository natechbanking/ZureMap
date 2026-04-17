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
      @for (sub of subscriptions; track sub.subscriptionId) {
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

  confirm(): void {
    if (this.selected.length > 0) this.confirmed.emit(this.selected);
  }
}
