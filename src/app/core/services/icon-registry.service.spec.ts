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
});
