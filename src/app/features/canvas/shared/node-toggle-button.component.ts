import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-node-toggle-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      data-export-hide
      [class]="buttonClass"
      [title]="title"
      (mousedown)="onMouseDown($event)"
      (click)="onClick($event)"
    >
      {{ label }}
    </button>
  `,
})
export class NodeToggleButtonComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) buttonClass!: string;
  @Output() toggled = new EventEmitter<MouseEvent>();

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.toggled.emit(event);
  }
}
