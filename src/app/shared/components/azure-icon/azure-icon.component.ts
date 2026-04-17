import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconRegistryService } from '../../../core/services/icon-registry.service';

const FALLBACK_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Crect width='18' height='18' rx='2' fill='%230078d4'/%3E%3Ctext x='9' y='13' text-anchor='middle' font-size='10' fill='white' font-family='sans-serif'%3E%E2%98%81%3C/text%3E%3C/svg%3E`;

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
  get resolvedUrl(): string {
    return this.registry.getIconUrl(this.resourceType);
  }

  onError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK_SVG;
  }
}
