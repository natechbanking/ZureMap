import { Injectable } from '@angular/core';
import { HybridResourceCatalogEntry, RESOURCE_TYPE_MAP, ResourceCatalogMetadata, ResourceCatalogSource } from '../constants/resource-type-catalog';

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
  private readonly cache = new Map<string, string>();
  private readonly BASE_PATH = 'icons/';
  readonly fallbackIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Crect width='18' height='18' rx='2' fill='%230078d4'/%3E%3Ctext x='9' y='13' text-anchor='middle' font-size='10' fill='white' font-family='sans-serif'%3E%E2%98%81%3C/text%3E%3C/svg%3E";
  private manifest: Record<string, string> = {};

  async loadManifest(): Promise<void> {
    try {
      const resp = await fetch('icons/icon-manifest.json');
      if (resp.ok) {
        const data = await resp.json();
        this.manifest = data.mappings ?? {};
      }
    } catch {
      // manifest not available, use built-in map
    }
    this.cache.clear();
  }

  getIconUrl(resourceType: string): string {
    const normalized = this.normalizeType(resourceType);
    if (this.cache.has(normalized)) return this.cache.get(normalized)!;

    const builtIn = RESOURCE_TYPE_MAP[normalized]?.icon;
    const fromManifest = this.manifest[normalized];
    const filename = builtIn ?? fromManifest;

    const url = filename ? `${this.BASE_PATH}${filename}` : this.fallbackIcon;
    this.cache.set(normalized, url);
    return url;
  }

  getTypeLabel(resourceType: string): string {
    return RESOURCE_TYPE_MAP[this.normalizeType(resourceType)]?.label ?? this.humanizeType(resourceType);
  }

  getResourceTypeCatalog(): HybridResourceCatalogEntry[] {
    return this.getHybridResourceTypeCatalog();
  }

  getHybridResourceTypeCatalog(discoveredTypes: string[] = []): HybridResourceCatalogEntry[] {
    const byType = new Map<string, HybridResourceCatalogEntry>();

    const putEntry = (type: string, source: ResourceCatalogSource): void => {
      const normalized = this.normalizeType(type);
      if (!normalized || byType.has(normalized)) return;

      const curated = RESOURCE_TYPE_MAP[normalized];
      const manifestIcon = this.manifest[normalized];

      const effectiveSource: ResourceCatalogSource = curated
        ? 'curated'
        : manifestIcon
          ? 'manifest'
          : source;

      const label = curated?.label ?? this.humanizeType(type);
      const category = this.resolveCategory(normalized, curated, manifestIcon);

      byType.set(normalized, {
        type: normalized,
        label,
        category,
        source: effectiveSource,
        iconUrl: this.getIconUrl(normalized),
      });
    };

    for (const type of Object.keys(RESOURCE_TYPE_MAP)) {
      putEntry(type, 'curated');
    }

    for (const type of Object.keys(this.manifest)) {
      putEntry(type, 'manifest');
    }

    for (const type of discoveredTypes) {
      putEntry(type, 'discovered');
    }

    return Array.from(byType.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  private resolveCategory(type: string, curated: ResourceCatalogMetadata | undefined, manifestIcon: string | undefined): string {
    if (curated?.category) return curated.category;
    if (curated?.icon.includes('/')) return curated.icon.split('/')[0];
    if (manifestIcon?.includes('/')) return manifestIcon.split('/')[0];

    const [provider] = type.split('/');
    return provider?.replace(/^microsoft\./i, '').replace(/\./g, '-') || 'other';
  }

  private normalizeType(resourceType: string): string {
    return resourceType.trim().toLowerCase();
  }

  private humanizeType(type: string): string {
    const parts = type.split('/');
    const last = parts[parts.length - 1] ?? type;
    return last.replace(/([A-Z])/g, ' $1').replace(/[-_]+/g, ' ').trim();
  }
}
