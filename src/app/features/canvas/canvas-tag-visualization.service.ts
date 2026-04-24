import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';

@Injectable({ providedIn: 'root' })
export class CanvasTagVisualizationService {
  apply(nodes: DiagramNode[], nodeId: string): DiagramNode[] | null {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const tags = node.metadata?.tags ?? {};
    const entries = Object.entries(tags)
      .filter(([key]) => key.trim().length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return null;

    const maxTags = 40;
    const visibleEntries = entries.slice(0, maxTags);
    const hiddenCount = entries.length - visibleEntries.length;
    const compactEntries: Array<[string, string]> = hiddenCount > 0
      ? [...visibleEntries, ['_more', `+${hiddenCount} more`] as [string, string]]
      : visibleEntries;

    const tagItemPrefix = 'tagviz-';
    const preservedItems = (node.custom?.internalItems ?? []).filter(item => !item.id.startsWith(tagItemPrefix));
    const generatedItems = this.layoutTagItems(compactEntries, node.size.width, tagItemPrefix);
    const allItems = [...preservedItems, ...generatedItems];

    const estimatedItemHeight = 18;
    const bottomPadding = 12;
    const requiredHeight = allItems.length === 0
      ? node.size.height
      : Math.max(
          node.size.height,
          ...allItems.map(item => item.y + estimatedItemHeight + bottomPadding),
        );

    const deltaHeight = requiredHeight - node.size.height;
    const cutoffY = node.position.y + node.size.height - 2;
    const subId = node.metadata?.subscriptionId || '';
    const rg = node.metadata?.resourceGroup || node.groupId || '';

    return nodes.map(n => {
      if (n.id === node.id) {
        return {
          ...n,
          size: { ...n.size, height: requiredHeight },
          custom: { ...(n.custom ?? {}), internalItems: allItems },
        };
      }

      if (deltaHeight <= 0) return n;
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + deltaHeight) } };
    });
  }

  private layoutTagItems(
    entries: Array<[string, string]>,
    nodeWidth: number,
    prefix: string,
  ): Array<{ id: string; text: string; x: number; y: number }> {
    const startX = 8;
    const startY = 56;
    const colGap = 6;
    const rowHeight = 18;
    const itemFootprintWidth = 96;
    const usableWidth = Math.max(40, nodeWidth - 16);
    const columns = Math.max(1, Math.floor((usableWidth + colGap) / (itemFootprintWidth + colGap)));

    return entries.map(([key, value], index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const xUnclamped = startX + col * (itemFootprintWidth + colGap);
      const x = Math.max(2, Math.min(Math.max(2, nodeWidth - 24), xUnclamped));
      const y = startY + row * rowHeight;
      const text = key === '_more' ? value : `${key}: ${value}`;
      const stableKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `tag-${index}`;
      return {
        id: `${prefix}${stableKey}`,
        text,
        x,
        y,
      };
    });
  }
}
