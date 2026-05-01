import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ACTION_ICONS, ActionIconName } from '../../icons/action-icons';

@Component({
  selector: 'app-action-icon',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <fa-icon
      [icon]="iconDef"
      [fixedWidth]="fixedWidth"
      [ngClass]="iconClass"
      aria-hidden="true"
    />
  `,
})
export class ActionIconComponent {
  @Input({ required: true }) icon!: ActionIconName;
  @Input() iconClass = 'w-3.5 h-3.5';
  @Input() fixedWidth = false;

  get iconDef() {
    return ACTION_ICONS[this.icon];
  }
}
