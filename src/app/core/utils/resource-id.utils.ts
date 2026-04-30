/**
 * Normalizes an Azure resource ID to a canonical lowercase form for comparison.
 * Trims whitespace and removes trailing slashes.
 */
export function normalizeResourceId(resourceId: string): string {
  return resourceId.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Extracts the parent ARM resource ID by stripping `segmentsFromEnd` type/name
 * pairs from the tail of the resource ID.
 *
 * @example
 * extractParentResourceId('/subscriptions/x/resourceGroups/y/providers/Microsoft.Sql/servers/s/databases/d', 1)
 * // → '/subscriptions/x/resourceGroups/y/providers/Microsoft.Sql/servers/s'
 */
export function extractParentResourceId(resourceId: string, segmentsFromEnd = 1): string | null {
  const parts = resourceId.split('/').filter(Boolean);
  const stripped = parts.slice(0, parts.length - segmentsFromEnd * 2);
  return stripped.length > 0 ? `/${stripped.join('/')}` : null;
}

/**
 * Extracts the portion of a resource ID before the first occurrence of `pathMarker`.
 *
 * @example
 * extractResourceIdBeforePath('/subscriptions/x/.../servers/s/databases/d', '/databases/')
 * // → '/subscriptions/x/.../servers/s'
 */
export function extractResourceIdBeforePath(resourceId: string, pathMarker: string): string | null {
  const idx = resourceId.toLowerCase().indexOf(pathMarker.toLowerCase());
  return idx > 0 ? resourceId.slice(0, idx) : null;
}
