import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { DiagramEdge } from '../../core/models/diagram-edge.model';
import { AzureSubscription } from '../../core/models/azure-resource.model';
import { RgBound, RouteTableBound, SubscriptionBound, VmBound, K8sNamespaceBound, K8sScopeBound, K8sClusterBound } from './canvas.types';

export interface VisibilityInput {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  activeSubscriptions: AzureSubscription[];
  collapsedSubscriptions: Set<string>;
  collapsedResourceGroups: Set<string>;
  collapsedVmGroups: Set<string>;
  collapsedRouteTableGroups: Set<string>;
  collapsedK8sNamespaces: Set<string>;
  collapsedK8sScopes: Set<string>;
  collapsedK8sClusters: Set<string>;
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
  k8sNamespaceBounds: K8sNamespaceBound[];
  k8sScopeBounds: K8sScopeBound[];
  k8sClusterBounds: K8sClusterBound[];
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
      collapsedK8sNamespaces,
      collapsedK8sScopes,
      collapsedK8sClusters,
      customContainerNames,
      selectedEdgeId,
    } = input;

    const isVisibleBySubscription = (n: DiagramNode) => {
      const subscriptionId = n.metadata?.subscriptionId || '';
      if (n.group === 'k8sNamespace') {
        // Hidden if its scope is collapsed
        const scopeKey = subscriptionId || '__unknown-scope__';
        return !collapsedK8sScopes.has(scopeKey);
      }
      return !collapsedSubscriptions.has(subscriptionId);
    };

    const baseVisibleNodes = nodes.filter(n => {
      if (!isVisibleBySubscription(n)) return false;
      if (n.group === 'k8sNamespace') {
        // Hide all K8s nodes when the synthetic cluster is collapsed
        if (collapsedK8sClusters.has('__k8s-cluster__')) return false;
        const ns = n.metadata?.resourceGroup || n.groupId || '';
        const scopeId = n.metadata?.subscriptionId || '';
        if (!ns) return true;
        return !collapsedK8sNamespaces.has(`${scopeId}::${ns}`);
      }
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
    const k8sNamespaceBounds = this.computeK8sNamespaceBounds(nodes.filter(isVisibleBySubscription), collapsedK8sNamespaces, customContainerNames);
    const k8sScopeBounds = this.computeK8sScopeBounds(k8sNamespaceBounds, nodes, activeSubscriptions, collapsedK8sScopes, customContainerNames);
    const k8sClusterBounds = this.computeK8sClusterBounds(k8sScopeBounds, k8sNamespaceBounds, nodes, collapsedK8sClusters, customContainerNames);

    return { visibleNodes, visibleEdges, rgBounds, subscriptionBounds, vmBounds, routeTableBounds, k8sNamespaceBounds, k8sScopeBounds, k8sClusterBounds, selectedEdgeVisible };
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
        y: yMin - PAD - LABEL_H,
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
    if (node.group === 'standalone' || node.group === 'k8sNamespace') return '';
    return node.metadata?.resourceGroup || node.groupId || '';
  }

  computeK8sNamespaceBounds(
    nodes: DiagramNode[],
    collapsedK8sNamespaces: Set<string>,
    customContainerNames: Map<string, string>,
  ): K8sNamespaceBound[] {
    const PAD = 28; const LABEL_H = 28;
    const map = new Map<string, { scopeId: string; name: string; nodes: DiagramNode[] }>();
    for (const n of nodes) {
      if (n.group !== 'k8sNamespace') continue;
      const ns = n.metadata?.resourceGroup || n.groupId || '';
      const scopeId = n.metadata?.subscriptionId || '';
      if (!ns) continue;
      const id = `${scopeId}::${ns}`;
      if (!map.has(id)) map.set(id, { scopeId, name: ns, nodes: [] });
      map.get(id)!.nodes.push(n);
    }
    return Array.from(map.entries()).map(([id, entry]) => {
      const { scopeId, nodes: nsNodes } = entry;
      const name = customContainerNames.get(`k8sns::${id}`) ?? entry.name;
      const xMin = Math.min(...nsNodes.map(n => n.position.x));
      const yMin = Math.min(...nsNodes.map(n => n.position.y));
      const xMax = Math.max(...nsNodes.map(n => n.position.x + n.size.width));
      const yMax = Math.max(...nsNodes.map(n => n.position.y + n.size.height));
      const collapsed = collapsedK8sNamespaces.has(id);
      return {
        id,
        scopeId,
        name,
        collapsed,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        width: collapsed ? Math.max(220, Math.ceil(name.length * 7.5) + 72) : xMax + PAD - (xMin - PAD),
        height: collapsed ? LABEL_H + 8 : yMax + PAD - (yMin - PAD - LABEL_H),
      };
    });
  }

  computeK8sScopeBounds(
    nsBounds: K8sNamespaceBound[],
    nodes: DiagramNode[],
    activeSubscriptions: AzureSubscription[],
    collapsedK8sScopes: Set<string>,
    customContainerNames: Map<string, string>,
  ): K8sScopeBound[] {
    if (nsBounds.length === 0) return [];
    const scopeIds = new Set(nsBounds.map(b => b.scopeId).filter(Boolean));
    if (scopeIds.size <= 1) {
      // Only render scope boxes when there are 2+ scopes
      const nodeSubCount = new Set(nodes.filter(n => n.group === 'k8sNamespace').map(n => n.metadata?.subscriptionId).filter(Boolean)).size;
      if (nodeSubCount <= 1) return [];
    }

    const PAD = 24; const LABEL_H = 32;
    const nameByScope = new Map(activeSubscriptions.map(s => [s.subscriptionId, s.name]));
    const map = new Map<string, K8sNamespaceBound[]>();
    for (const bound of nsBounds) {
      if (!map.has(bound.scopeId)) map.set(bound.scopeId, []);
      map.get(bound.scopeId)!.push(bound);
    }
    return Array.from(map.entries()).map(([scopeId, groups]) => {
      const xMin = Math.min(...groups.map(g => g.x));
      const yMin = Math.min(...groups.map(g => g.y));
      const xMax = Math.max(...groups.map(g => g.x + g.width));
      const yMax = Math.max(...groups.map(g => g.y + g.height));
      const scopeKey = scopeId || '__unknown-scope__';
      const collapsed = collapsedK8sScopes.has(scopeKey);
      const defaultName = nameByScope.get(scopeId) || scopeId || 'Unknown scope';
      const name = customContainerNames.get(`k8sscope::${scopeKey}`) ?? defaultName;
      return {
        id: scopeKey,
        scopeId,
        name,
        collapsed,
        x: xMin - PAD,
        y: yMin - PAD - LABEL_H,
        width: collapsed ? Math.max(320, Math.ceil(name.length * 7.5) + 96) : xMax - xMin + PAD * 2,
        height: collapsed ? LABEL_H + 12 : yMax - yMin + PAD * 2 + LABEL_H,
      };
    });
  }

  computeK8sClusterBounds(
    scopeBounds: K8sScopeBound[],
    namespaceBounds: K8sNamespaceBound[],
    nodes: DiagramNode[],
    collapsedK8sClusters: Set<string>,
    customContainerNames: Map<string, string>,
  ): K8sClusterBound[] {
    // Use scope bounds when available (multiple scopes), otherwise fall back to namespace bounds
    const containerBounds = scopeBounds.length > 0 ? scopeBounds : namespaceBounds;

    if (containerBounds.length === 0) return [];

    const PAD = 28; const LABEL_H = 36;

    // Always produce a single synthetic cluster container to avoid multiple
    // overlapping boxes when multiple AKS nodes exist on the canvas.
    const boundsToMeasure: { x: number; y: number; width: number; height: number }[] = [...containerBounds];

    // Expand bounds to include any AKS cluster nodes on the canvas
    const aksNodes = nodes.filter(
      n => n.group === 'standalone'
        && n.resourceType?.toLowerCase().includes('managedcluster'),
    );
    for (const aks of aksNodes) {
      boundsToMeasure.push({ x: aks.position.x, y: aks.position.y, width: aks.size.width, height: aks.size.height });
    }

    const xMin = Math.min(...boundsToMeasure.map(b => b.x));
    const yMin = Math.min(...boundsToMeasure.map(b => b.y));
    const xMax = Math.max(...boundsToMeasure.map(b => b.x + b.width));
    const yMax = Math.max(...boundsToMeasure.map(b => b.y + b.height));
    const clusterId = '__k8s-cluster__';
    const collapsed = collapsedK8sClusters.has(clusterId);
    const name = customContainerNames.get(`k8scluster::${clusterId}`) ?? 'Kubernetes Cluster';

    return [{
      id: clusterId,
      name,
      collapsed,
      x: xMin - PAD,
      y: yMin - PAD - LABEL_H,
      width: collapsed ? Math.max(320, Math.ceil(name.length * 7.5) + 96) : xMax - xMin + PAD * 2,
      height: collapsed ? LABEL_H + 12 : yMax - yMin + PAD * 2 + LABEL_H,
    }];
  }
}
