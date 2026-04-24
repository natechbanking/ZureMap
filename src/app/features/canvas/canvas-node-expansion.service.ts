import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';

interface ExpansionOptions {
  nodeId: string;
  expanded: boolean;
  panelHeight: number;
}

@Injectable({ providedIn: 'root' })
export class CanvasNodeExpansionService {
  apply(
    nodes: DiagramNode[],
    collapsedHeights: Map<string, number>,
    options: ExpansionOptions,
  ): DiagramNode[] | null {
    const node = nodes.find(n => n.id === options.nodeId);
    if (!node) return null;

    const currentHeight = node.size.height;
    const collapsedHeight = collapsedHeights.get(options.nodeId) ?? currentHeight;
    if (options.expanded && !collapsedHeights.has(options.nodeId)) {
      collapsedHeights.set(options.nodeId, currentHeight);
    }
    if (!options.expanded) {
      collapsedHeights.delete(options.nodeId);
    }

    const targetHeight = options.expanded
      ? Math.max(currentHeight, collapsedHeight + options.panelHeight)
      : collapsedHeight;
    const delta = targetHeight - currentHeight;
    if (delta === 0) return null;

    const subId = node.metadata?.subscriptionId || '';
    const rg = node.metadata?.resourceGroup || node.groupId || '';
    const cutoffY = node.position.y + currentHeight - 2;

    return nodes.map(n => {
      if (n.id === node.id) {
        return { ...n, size: { ...n.size, height: targetHeight } };
      }
      const sameSub = (n.metadata?.subscriptionId || '') === subId;
      const sameRg = (n.metadata?.resourceGroup || n.groupId || '') === rg;
      if (!sameSub || !sameRg || n.position.y < cutoffY) return n;
      return { ...n, position: { ...n.position, y: Math.max(0, n.position.y + delta) } };
    });
  }
}
