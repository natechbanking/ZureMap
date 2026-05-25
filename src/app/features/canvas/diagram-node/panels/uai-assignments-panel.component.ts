import { ChangeDetectionStrategy, Component, Input } from '@angular/core';


export interface UaiRoleAssignmentView {
  id: string;
  roleDefinitionName: string;
  scope: string;
  principalType: string;
  description: string | null;
}

@Component({
  selector: 'app-uai-assignments-panel',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded border border-sky-200 bg-white shadow-sm overflow-hidden" role="presentation" (mousedown)="stop($event)" (click)="stop($event)" (keydown)="stop($event)">
      @if (loading) {
        <p class="text-[10px] text-gray-400 px-2 py-1.5 text-center">Loading...</p>
      } @else if (error) {
        <p class="text-[10px] text-red-400 px-2 py-1.5">{{ error }}</p>
      } @else if (assignments.length === 0) {
        <p class="text-[10px] text-gray-500 px-2 py-1.5">No role assignments found for this identity.</p>
      } @else {
        <div class="space-y-1 p-1.5">
          @for (assignment of assignments; track assignment.id) {
            <div class="rounded border border-sky-100 bg-sky-50/40 px-1.5 py-1">
              <div class="flex items-center gap-1 mb-0.5">
                <p class="text-[10px] font-semibold text-gray-800 truncate flex-1" [title]="assignment.roleDefinitionName">{{ assignment.roleDefinitionName }}</p>
                <span class="text-[9px] px-1.5 py-px rounded-full bg-gray-100 text-gray-600 leading-tight shrink-0">{{ assignment.principalType }}</span>
              </div>
              <p class="text-[10px] text-gray-600 break-all leading-snug" [title]="assignment.scope"><span class="text-gray-400">Scope </span>{{ assignment.scope }}</p>
              @if (assignment.description) {
                <p class="text-[10px] text-gray-500 break-all leading-snug mt-0.5" [title]="assignment.description">{{ assignment.description }}</p>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class UaiAssignmentsPanelComponent {
  @Input({ required: true }) assignments: UaiRoleAssignmentView[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;

  stop(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
