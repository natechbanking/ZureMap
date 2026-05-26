import { Component, Input, inject } from '@angular/core';

import { IconRegistryService } from '../../../core/services/icon-registry.service';

@Component({
  selector: 'app-azure-icon',
  standalone: true,
  imports: [],
  template: `
    <img
      [src]="resolvedUrl"
      [alt]="resourceType"
      [style.width.px]="size"
      [style.height.px]="size"
      (error)="onError($event)"
      class="object-contain select-none"
    />
  `,
})
export class AzureIconComponent {
  @Input({ required: true }) resourceType!: string;
  @Input() size = 32;

  private registry = inject(IconRegistryService);
  get resolvedUrl(): string {
    return this.registry.getIconUrl(this.resourceType);
  }

  onError(event: Event): void {
    (event.target as HTMLImageElement).src = this.registry.fallbackIcon;
  }
}
