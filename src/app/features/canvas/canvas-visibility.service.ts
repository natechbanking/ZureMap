import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { DiagramEdge } from '../../core/models/diagram-edge.model';
import { AzureSubscription } from '../../core/models/azure-resource.model';
import { RgBound, RouteTableBound, SubscriptionBound, VmBound } from './canvas.types';

export interface VisibilityInput {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  activeSubscriptions: AzureSubscription[];
  collapsedSubscriptions: Set<string>;
  collapsedResourceGroups: Set<string>;
  collapsedVmGroups: Set<string>;
  collapsedRouteTableGroups: Set<string>;
  customContainerNames: Map<string, string>;
  selectedEdgeId: string | null;
}

export interface VisibilityResult {
  visibleNodes: DiagramNode[];
  visibleEdges: DiagramEdge[];
  rgBounds: RgBound[];
  subscriptionBounds: SubscriptionBound[];
  vmBounds: VmBound[];
  routeTableBounds: RouteTableBound[];
  selectedEdgeVisible: boolean;
}

@Injectable({ providedIn: 'root' })
export class CanvasVisibilityService {
  derive(input: VisibilityInput): VisibilityResult {
    const {
      nodes,
      edges,
      activeSubscriptions,
      collapsedSubscriptions,
      collapsedResourceGroups,
      collapsedVmGroups,
      collapsedRouteTableGroups,
      customContainerNames,
      selectedEdgeId,
    } = input;

    const isVisibleBySubscription = (n: DiagramNode) => {
      const subscriptionId = n.metadata?.subscriptionId || '';
      return !collapsedSubscriptions.has(subscriptionId);
    };

    const baseVisibleNodes = nodes.filter(n => {
      if (!isVisibleBySubscription(n)) return false;
      const rg = this.nodeResourceGroup(n);
      const subscriptionId = n.metadata?.subscriptionId || '';
      if (!rg) return true;
      return !collapsedResourceGroups.has(`${subscriptionId}::${rg}`);
    });

    const hiddenByVmCollapse = new Set<string>();
    const baseById = new Map(baseVisibleNodes.map(n => [n.id, n]));
    for (const vmId of collapsedVmGroups) {
      const vm = baseById.get(vmId);
      if (!vm) continue;
      for (const childId of vm.children ?? []) hiddenByVmCollapse.add(childId);
    }

    const hiddenByRouteTableCollapse = new Set<string>();
    for (const routeTableId of collapsedRouteTableGroups) {
      const routeTable = baseById.get(routeTableId);
      if (!routeTable) continue;
      for (const childId of routeTable.children ?? []) {
        const child = baseById.get(childId);
        if (child?.resourceType === 'microsoft.network/routetables/routes') {
          hiddenByRouteTableCollapse.add(childId);
        }
      }
    }

    const visibleNodes = baseVisibleNodes.filter(n =>
      !hiddenByVmCollapse.has(n.id) && !hiddenByRouteTableCollapse.has(n.id),
    );

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = edges.filter(e => {
      const srcOk = e.sourceAnnotationId ? true : visibleIds.has(e.sourceId);
      const tgtOk = e.targetAnnotationId ? true : visibleIds.has(e.targetId);
      return srcOk && tgtOk;
    });
    const selectedEdgeVisible = selectedEdgeId ? visibleEdges.some(e => e.id === selectedEdgeId) : false;

    const rgBounds = this.computeRgBounds(nodes.filter(isVisibleBySubscription), collapsedResourceGroups, customContainerNames);
    const subscriptionBounds = this.computeSubscriptionBounds(
      rgBounds,
      nodes,
      activeSubscriptions,
      collapsedSubscriptions,
      customContainerNames,
    );
    const vmBounds = this.computeVmBounds(baseVisibleNodes, collapsedVmGroups, customContainerNames);
    const routeTableBounds = this.computeRouteTableBounds(baseVisibleNodes, collapsedRouteTableGroups, customContainerNames);

    return { visibleNodes, visibleEdges, rgBounds, subscriptionBounds, vmBounds, routeTableBounds, selectedEdgeVisible };
  }

  computeRgBounds(nodes: DiagramNode[], collapsedResourceGroups: Set<string>, customContainerNames: Map<string, string>): RgBound[] {
    const PAD = 28; const LABEL_H = 28;
    const map = new Map<string, { subscriptionId: string; name: string; nodes: DiagramNode[] }>();
    for (const n of nodes) {
      const rg = this.nodeResourceGroup(n);
      const subscriptionId = n.metadata?.subscriptionId || '';
      if (!rg) continue;
      const id = `${subscriptionId}::${rg}`;
      if (!map.has(id)) map.set(id, { subscriptionId, name: rg, nodes: [] });
      map.get(id)!.nodes.push(n);
    }
    return Array.from(map.entries()).map(([id, entry]) => {
      const { subscriptionId, nodes: rgNodes } = entry;
      const name = customContainerNames.get(`rg::${id}`) ?? entry.name;
      const xMin = Math.min(...rgNodes.map(n => n.position.x));
      const yMin = Math.min(...rgNodes.map(n => n.position.y));
      const xMax = Math.max(...rgNodes.map(n => n.position.x + n.size.width));
      const yMax = Math.max(...rgNodes.map(n => n.position.y + n.size.height));
      const collapsed = collapsedResourceGroups.has(id);

      return {
        id,
        subscriptionId,
        name,
        collapsed,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        width: collapsed ? Math.max(220, Math.ceil(name.length * 7.5) + 72) : xMax + PAD - (xMin - PAD),
        height: collapsed ? LABEL_H + 8 : yMax + PAD - (yMin - PAD - LABEL_H),
      };
    });
  }

  computeSubscriptionBounds(
    rgBounds: RgBound[],
    nodes: DiagramNode[],
    activeSubscriptions: AzureSubscription[],
    collapsedSubscriptions: Set<string>,
    customContainerNames: Map<string, string>,
  ): SubscriptionBound[] {
    const activeSubCount = activeSubscriptions.length;
    const nodeSubCount = new Set(nodes.map(n => n.metadata?.subscriptionId).filter(Boolean)).size;
    if (activeSubCount <= 1 && nodeSubCount <= 1) return [];

    const PAD = 24;
    const LABEL_H = 32;
    const MIN_Y = 8;
    const nameBySubscriptionId = new Map(activeSubscriptions.map(s => [s.subscriptionId, s.name]));
    const map = new Map<string, RgBound[]>();
    for (const bound of rgBounds) {
      if (!map.has(bound.subscriptionId)) map.set(bound.subscriptionId, []);
      map.get(bound.subscriptionId)!.push(bound);
    }

    return Array.from(map.entries()).map(([subscriptionId, groups]) => {
      const xMin = Math.min(...groups.map(g => g.x));
      const yMin = Math.min(...groups.map(g => g.y));
      const xMax = Math.max(...groups.map(g => g.x + g.width));
      const yMax = Math.max(...groups.map(g => g.y + g.height));
      const collapsed = collapsedSubscriptions.has(subscriptionId);

      const defaultSubName = nameBySubscriptionId.get(subscriptionId) || subscriptionId || 'Unknown subscription';
      return {
        id: subscriptionId || '__unknown-subscription__',
        subscriptionId,
        name: customContainerNames.get(`sub::${subscriptionId}`) ?? defaultSubName,
        x: xMin - PAD,
        y: Math.max(MIN_Y, yMin - PAD - LABEL_H),
        collapsed,
        width: collapsed ? Math.max(320, Math.ceil(defaultSubName.length * 7.5) + 96) : xMax - xMin + PAD * 2,
        height: collapsed ? LABEL_H + 12 : yMax - yMin + PAD * 2 + LABEL_H,
      };
    });
  }

  computeVmBounds(nodes: DiagramNode[], collapsedVmGroups: Set<string>, customContainerNames: Map<string, string>): VmBound[] {
    const PAD = 14;
    const LABEL_H = 20;
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const bounds: VmBound[] = [];

    for (const vm of nodes) {
      if (vm.resourceType !== 'microsoft.compute/virtualmachines') continue;
      if (!vm.children?.length) continue;

      const members: DiagramNode[] = [vm];
      for (const childId of vm.children) {
        const child = nodeById.get(childId);
        if (child) members.push(child);
      }
      if (members.length < 2) continue;

      const xMin = Math.min(...members.map(n => n.position.x));
      const yMin = Math.min(...members.map(n => n.position.y));
      const xMax = Math.max(...members.map(n => n.position.x + n.size.width));
      const yMax = Math.max(...members.map(n => n.position.y + n.size.height));
      const collapsed = collapsedVmGroups.has(vm.id);
      const vmName = customContainerNames.get(`vm::${vm.id}`) ?? vm.label;

      bounds.push({
        id: vm.id,
        name: vmName,
        collapsed,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        width: collapsed ? Math.max(220, Math.ceil(vm.label.length * 7.5) + 88) : xMax + PAD - (xMin - PAD),
        height: collapsed ? LABEL_H + 10 : yMax + PAD - (yMin - PAD - LABEL_H),
      });
    }
    return bounds;
  }

  computeRouteTableBounds(nodes: DiagramNode[], collapsedRouteTableGroups: Set<string>, customContainerNames: Map<string, string>): RouteTableBound[] {
    const PAD = 12;
    const LABEL_H = 20;
    const GAP_BELOW_PARENT = 6;
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const bounds: RouteTableBound[] = [];

    for (const routeTable of nodes) {
      if (routeTable.resourceType !== 'microsoft.network/routetables') continue;

      const routeNodes = (routeTable.children ?? [])
        .map(id => nodeById.get(id))
        .filter((n): n is DiagramNode => !!n && n.resourceType === 'microsoft.network/routetables/routes');
      if (routeNodes.length === 0) continue;

      const collapsed = collapsedRouteTableGroups.has(routeTable.id);
      const rtName = customContainerNames.get(`rt::${routeTable.id}`) ?? routeTable.label;
      const tableBottom = routeTable.position.y + routeTable.size.height;
      const yStart = tableBottom + GAP_BELOW_PARENT;
      const childBottom = Math.max(yStart, ...routeNodes.map(n => n.position.y + n.size.height));

      const xMin = Math.min(routeTable.position.x, ...routeNodes.map(n => n.position.x));
      const xMax = Math.max(routeTable.position.x + routeTable.size.width, ...routeNodes.map(n => n.position.x + n.size.width));

      bounds.push({
        id: routeTable.id,
        name: rtName,
        collapsed,
        x: xMin - PAD,
        y: yStart,
        width: collapsed ? Math.max(220, Math.ceil(routeTable.label.length * 7.5) + 88) : xMax - xMin + PAD * 2,
        height: collapsed ? LABEL_H + 10 : Math.max(LABEL_H + 10, childBottom - yStart + PAD),
      });
    }
    return bounds;
  }

  private nodeResourceGroup(node: DiagramNode): string {
    if (node.group === 'standalone') return '';
    return node.metadata?.resourceGroup || node.groupId || '';
  }
}
