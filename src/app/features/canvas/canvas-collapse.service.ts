import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';

@Injectable({ providedIn: 'root' })
export class CanvasCollapseService {
  toggleSubscription(
    collapsed: Set<string>,
    subscriptionId: string,
    selectedNode: DiagramNode | null,
  ): { next: Set<string>; clearSelection: boolean } {
    const next = new Set(collapsed);
    if (next.has(subscriptionId)) {
      next.delete(subscriptionId);
      return { next, clearSelection: false };
    }

    next.add(subscriptionId);
    const selectedSub = selectedNode?.metadata?.subscriptionId || '';
    return { next, clearSelection: !!selectedNode && selectedSub === subscriptionId };
  }

  toggleResourceGroup(
    collapsed: Set<string>,
    rgId: string,
    selectedNode: DiagramNode | null,
  ): { next: Set<string>; clearSelection: boolean } {
    const next = new Set(collapsed);
    if (next.has(rgId)) {
      next.delete(rgId);
      return { next, clearSelection: false };
    }

    next.add(rgId);
    const selectedRgId = `${selectedNode?.metadata?.subscriptionId || ''}::${selectedNode?.metadata?.resourceGroup || selectedNode?.groupId || ''}`;
    return { next, clearSelection: !!selectedNode && selectedRgId === rgId };
  }

  toggleVm(
    collapsed: Set<string>,
    vmId: string,
    nodes: DiagramNode[],
    selectedNode: DiagramNode | null,
  ): { next: Set<string>; clearSelection: boolean } {
    const next = new Set(collapsed);
    if (next.has(vmId)) {
      next.delete(vmId);
      return { next, clearSelection: false };
    }

    next.add(vmId);
    const vmNode = nodes.find(n => n.id === vmId);
    const selectedInVm = !!selectedNode && !!vmNode
      && (selectedNode.id === vmId || (vmNode.children ?? []).includes(selectedNode.id));

    return { next, clearSelection: selectedInVm };
  }

  toggleRouteTable(
    collapsed: Set<string>,
    routeTableId: string,
    nodes: DiagramNode[],
    selectedNode: DiagramNode | null,
  ): { next: Set<string>; clearSelection: boolean } {
    const next = new Set(collapsed);
    if (next.has(routeTableId)) {
      next.delete(routeTableId);
      return { next, clearSelection: false };
    }

    next.add(routeTableId);
    const rtNode = nodes.find(n => n.id === routeTableId);
    const selectedInRt = !!selectedNode && !!rtNode
      && (selectedNode.id === routeTableId || (rtNode.children ?? []).includes(selectedNode.id));

    return { next, clearSelection: selectedInRt };
  }
}
