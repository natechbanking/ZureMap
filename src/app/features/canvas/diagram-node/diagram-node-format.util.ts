export interface DetailKv {
  label: string;
  value: string;
}

export function toDisplayText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

export function toListText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map(v => toDisplayText(v))
    .filter((v): v is string => !!v);
  return items.length > 0 ? items.join(', ') : null;
}

export function getPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function pickText(obj: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const text = toDisplayText(getPath(obj, path));
    if (text) return text;
  }
  return null;
}

export function pickListText(obj: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const list = toListText(getPath(obj, path));
    if (list) return list;
  }
  return null;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return null;
}

export function toArrayCount(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

export function toCsvCount(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(',').map(v => v.trim()).filter(Boolean).length;
}

export function toArrayCountText(value: unknown): string | null {
  const count = toArrayCount(value);
  return count === null ? null : count.toString();
}

export function toBoolText(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

export function toTitleLabel(raw: string): string {
  const spaced = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function toTextStat(label: string, value: string | null): DetailKv | null {
  if (!value) return null;
  return { label, value };
}

export function toNumberStat(label: string, value: number | null): DetailKv | null {
  if (value === null) return null;
  return { label, value: value.toString() };
}
