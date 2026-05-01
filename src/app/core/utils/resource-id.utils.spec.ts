import { extractParentResourceId, extractResourceIdBeforePath, normalizeResourceId } from './resource-id.utils';

describe('resource-id.utils', () => {
  it('normalizes casing, whitespace, and trailing slashes', () => {
    const normalized = normalizeResourceId('  /Subscriptions/Sub1/ResourceGroups/RG1/  ');
    expect(normalized).toBe('/subscriptions/sub1/resourcegroups/rg1');
  });

  it('extracts parent resource id by pair count', () => {
    const parent = extractParentResourceId('/subscriptions/s/resourceGroups/rg/providers/Microsoft.Sql/servers/s1/databases/d1', 1);
    expect(parent).toBe('/subscriptions/s/resourceGroups/rg/providers/Microsoft.Sql/servers/s1');
  });

  it('returns null when stripping all segments', () => {
    const parent = extractParentResourceId('/subscriptions/s', 2);
    expect(parent).toBeNull();
  });

  it('extracts prefix before case-insensitive path marker', () => {
    const root = extractResourceIdBeforePath('/subscriptions/s/providers/Microsoft.Sql/servers/s1/databases/d1', '/DATABASES/');
    expect(root).toBe('/subscriptions/s/providers/Microsoft.Sql/servers/s1');
  });
});
