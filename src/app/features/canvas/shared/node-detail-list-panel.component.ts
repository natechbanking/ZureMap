import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface NodeDetailListItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

export interface NodeDetailListSection {
  title: string;
  items: NodeDetailListItem[];
}

@Component({
  selector: 'app-node-detail-list-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full mt-1 rounded bg-white shadow-sm p-1.5" [ngClass]="containerClass" (mousedown)="stop($event)" (click)="stop($event)">
      @if (sections.length === 0 || totalItemCount === 0) {
        <p class="text-[10px] text-gray-500 px-1 py-0.5">{{ emptyText }}</p>
      } @else {
        <div class="space-y-1">
          @for (section of sections; track section.title) {
            @if (section.items.length > 0) {
              @if (section.title) {
                <p class="text-[9px] font-semibold uppercase tracking-wide mb-1" [ngClass]="sectionTitleClass">{{ section.title }}</p>
              }
              @for (item of section.items; track item.id) {
                <div class="rounded px-1.5 py-1" [ngClass]="itemClass">
                  <p class="text-[10px] font-semibold text-gray-800 truncate" [title]="item.title">{{ item.title }}</p>
                  @if (item.subtitle) {
                    <p class="text-[10px] text-gray-600 truncate" [title]="item.subtitle">{{ item.subtitle }}</p>
                  }
                  @if (item.meta) {
                    <p class="text-[10px] text-gray-500 truncate" [title]="item.meta">{{ item.meta }}</p>
                  }
                </div>
              }
            }
          }
        </div>
      }
    </div>
  `,
})
export class NodeDetailListPanelComponent {
  @Input({ required: true }) sections: NodeDetailListSection[] = [];
  @Input({ required: true }) emptyText!: string;
  @Input({ required: true }) containerClass!: string;
  @Input({ required: true }) sectionTitleClass!: string;
  @Input({ required: true }) itemClass!: string;

  get totalItemCount(): number {
    return this.sections.reduce((sum, section) => sum + section.items.length, 0);
  }

  stop(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
