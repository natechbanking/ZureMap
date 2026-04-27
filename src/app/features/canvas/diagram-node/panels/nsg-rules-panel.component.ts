import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NsgRuleView } from '../diagram-node-list-details.mapper';

@Component({
  selector: 'app-nsg-rules-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded border border-orange-200 bg-white shadow-sm overflow-hidden" (mousedown)="stop($event)" (click)="stop($event)">
      @if (rules.length === 0) {
        <p class="text-[10px] text-gray-500 px-2 py-1.5">No security rules found.</p>
      } @else {
        @for (rule of rules; track rule.name + rule.priority) {
          <div class="px-2 py-1.5 border-b last:border-b-0" [ngClass]="rule.isDefault ? 'border-gray-100 bg-gray-50' : 'border-orange-50 bg-white'">
            <div class="flex items-center gap-1 flex-wrap mb-0.5">
              <span class="text-[9px] font-semibold px-1.5 py-px rounded-full leading-tight shrink-0" [ngClass]="rule.access === 'Allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">{{ rule.access }}</span>
              <span class="text-[9px] px-1.5 py-px rounded-full leading-tight shrink-0" [ngClass]="rule.direction === 'Inbound' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'">{{ rule.direction }}</span>
              <span class="text-[9px] text-gray-400 ml-auto shrink-0">#{{ rule.priority }}</span>
            </div>
            <p class="text-[10px] font-medium text-gray-800 break-all leading-snug" [title]="rule.name">{{ rule.name }}</p>
            <div class="mt-0.5 space-y-px">
              <p class="text-[9px] text-gray-500 break-all leading-snug"><span class="text-gray-400">From </span>{{ rule.sourceAddressPrefix }}</p>
              <p class="text-[9px] text-gray-500 leading-snug"><span class="text-gray-400">Port </span>{{ rule.destinationPortRange }} <span class="text-gray-400"> ({{ rule.protocol }})</span></p>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class NsgRulesPanelComponent {
  @Input({ required: true }) rules: NsgRuleView[] = [];

  stop(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
