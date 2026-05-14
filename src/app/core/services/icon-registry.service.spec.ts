import { IconRegistryService } from './icon-registry.service';

describe('IconRegistryService', () => {
  let service: IconRegistryService;

  beforeEach(() => {
    service = new IconRegistryService();
  });

  it('returns known icon URL for mapped resource type', () => {
    const url = service.getIconUrl('Microsoft.Compute/virtualMachines');
    expect(url).toContain('icons/compute/10021-icon-service-Virtual-Machine.svg');
  });

  it('returns fallback icon for unknown resource type', () => {
    const url = service.getIconUrl('custom.provider/widgets');
    expect(url).toContain('data:image/svg+xml');
  });

  it('humanizes unknown resource type label', () => {
    expect(service.getTypeLabel('microsoft.custom/myGreatThing')).toBe('my Great Thing');
  });

  it('loads icon manifest and uses mapped icon', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ mappings: {
      'microsoft.custom/type': 'other/custom-icon.svg',
    } }), { status: 200 }));

    await service.loadManifest();
    const url = service.getIconUrl('microsoft.custom/type');

    expect(url).toBe('icons/other/custom-icon.svg');
  });

  it('builds hybrid catalog with precedence curated > manifest > discovered', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ mappings: {
      'microsoft.compute/virtualmachines': 'other/wrong.svg',
      'microsoft.manifest/only': 'analytics/00039-icon-service-Event-Hubs.svg',
    } }), { status: 200 }));

    await service.loadManifest();

    const catalog = service.getHybridResourceTypeCatalog([
      'microsoft.manifest/only',
      'microsoft.discovered/thing',
      'microsoft.compute/virtualmachines',
    ]);

    const vm = catalog.find(e => e.type === 'microsoft.compute/virtualmachines');
    const manifestOnly = catalog.find(e => e.type === 'microsoft.manifest/only');
    const discoveredOnly = catalog.find(e => e.type === 'microsoft.discovered/thing');

    expect(vm?.source).toBe('curated');
    expect(vm?.iconUrl).toContain('compute/10021-icon-service-Virtual-Machine.svg');

    expect(manifestOnly?.source).toBe('manifest');
    expect(manifestOnly?.iconUrl).toContain('analytics/00039-icon-service-Event-Hubs.svg');

    expect(discoveredOnly?.source).toBe('discovered');
    expect(discoveredOnly?.label).toBe('thing');
    expect(discoveredOnly?.category).toBe('discovered');
  });

  it('deduplicates discovered entries by normalized type', () => {
    const catalog = service.getHybridResourceTypeCatalog([
      'MICROSOFT.CUSTOM/widgets',
      'microsoft.custom/widgets',
    ]);

    expect(catalog.filter(e => e.type === 'microsoft.custom/widgets').length).toBe(1);
  });
});
