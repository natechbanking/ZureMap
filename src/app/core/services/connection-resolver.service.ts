import { Injectable } from '@angular/core';
import { AzureResource } from '../models/azure-resource.model';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge, EdgeType, EDGE_STYLES } from '../models/diagram-edge.model';
import { AZURE_RESOURCE_TYPES } from '../constants/azure-resource-types';

@Injectable({ providedIn: 'root' })
export class ConnectionResolverService {

  resolveAll(
    resources: AzureResource[],
    nodes: DiagramNode[],
    options: { userAssignedIdentities?: boolean } = {},
  ): DiagramEdge[] {
    return [
      ...this.resolvePrivateLinkConnections(resources, nodes),
      ...this.resolveVNetPeering(resources, nodes),
      ...(options.userAssignedIdentities ? this.resolveManagedIdentityEdges(resources, nodes) : []),
    ];
  }

  resolvePrivateLinkConnections(resources: AzureResource[], nodes: DiagramNode[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const r of resources) {
      if (r.type.toLowerCase() !== AZURE_RESOURCE_TYPES.PRIVATE_ENDPOINT) continue;
      const conns = (r.properties['privateLinkServiceConnections'] as {
        properties: { privateLinkServiceId: string };
      }[]) ?? [];
      for (const conn of conns) {
        const targetId = conn.properties?.privateLinkServiceId;
        if (targetId && nodeIds.has(targetId)) {
          edges.push(this.createEdge(r.id, targetId, 'privateLink', true));
        }
      }
    }
    return edges;
  }

  resolveVNetSubnetEdges(resources: AzureResource[], nodes: DiagramNode[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const r of resources) {
      if (r.type.toLowerCase() !== AZURE_RESOURCE_TYPES.VIRTUAL_NETWORK) continue;
      const subnets = (r.properties['subnets'] as { id: string }[]) ?? [];
      for (const subnet of subnets) {
        if (subnet.id && nodeIds.has(subnet.id)) {
          edges.push(this.createEdge(r.id, subnet.id, 'subnetMembership', false));
        }
      }
    }
    return edges;
  }

  resolveVNetPeering(resources: AzureResource[], nodes: DiagramNode[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));
    const seen = new Set<string>();

    for (const r of resources) {
      if (r.type.toLowerCase() !== AZURE_RESOURCE_TYPES.VIRTUAL_NETWORK) continue;
      const peerings = (r.properties['virtualNetworkPeerings'] as {
        properties: { remoteVirtualNetwork: { id: string } };
      }[]) ?? [];
      for (const p of peerings) {
        const remoteId = p.properties?.remoteVirtualNetwork?.id;
        if (!remoteId || !nodeIds.has(remoteId)) continue;
        const key = [r.id, remoteId].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          edges.push(this.createEdge(r.id, remoteId, 'vnetPeering', false));
        }
      }
    }
    return edges;
  }

  resolveNsgAssociations(resources: AzureResource[], nodes: DiagramNode[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const r of resources) {
      const type = r.type.toLowerCase();
      if (type !== AZURE_RESOURCE_TYPES.NETWORK_INTERFACE && type !== AZURE_RESOURCE_TYPES.SUBNET) continue;
      const nsgId = (r.properties['networkSecurityGroup'] as { id: string })?.id;
      if (nsgId && nodeIds.has(nsgId) && nodeIds.has(r.id)) {
        edges.push(this.createEdge(r.id, nsgId, 'nsgAssociation', false));
      }
    }
    return edges;
  }

  resolveSqlDatabaseEdges(resources: AzureResource[], nodes: DiagramNode[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const r of resources) {
      if (!r.type.toLowerCase().includes(AZURE_RESOURCE_TYPES.SQL_DATABASE)) continue;
      const serverId = r.id.split('/databases/')[0];
      if (serverId && nodeIds.has(serverId) && nodeIds.has(r.id)) {
        edges.push(this.createEdge(serverId, r.id, 'dependency', false));
      }
    }
    return edges;
  }

  resolveManagedIdentityEdges(resources: AzureResource[], nodes: DiagramNode[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));
    const seen = new Set<string>();

    for (const r of resources) {
      const uaiMap = r.identity?.userAssignedIdentities;
      if (!uaiMap) continue;
      for (const uaiId of Object.keys(uaiMap)) {
        if (!nodeIds.has(uaiId) || !nodeIds.has(r.id)) continue;
        // Draw edge from UAI → resource (UAI is the source/identity, resource is the assignee)
        const key = `${uaiId}|${r.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(this.createEdge(uaiId, r.id, 'managedIdentity', false));
      }
    }
    return edges;
  }

  private createEdge(
    sourceId: string,
    targetId: string,
    edgeType: EdgeType,
    animated: boolean
  ): DiagramEdge {
    return {
      id: `${edgeType}-${sourceId}-${targetId}`,
      sourceId,
      targetId,
      edgeType,
      animated,
      style: EDGE_STYLES[edgeType],
    };
  }
}
