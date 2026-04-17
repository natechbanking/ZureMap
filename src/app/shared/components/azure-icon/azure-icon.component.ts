import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconRegistryService } from '../../../core/services/icon-registry.service';

@Component({
  selector: 'app-azure-icon',
  standalone: true,
  imports: [CommonModule],
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
  private fallbackUrl = 'assets/azure-icons/Resource-Groups.svg';

  get resolvedUrl(): string {
    return this.registry.getIconUrl(this.resourceType);
  }

  onError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackUrl;
  }
}
