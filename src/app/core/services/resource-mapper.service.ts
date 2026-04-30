import { Injectable, inject } from '@angular/core';
import { AzureResource } from '../models/azure-resource.model';
import { DiagramNode, LayoutGroup } from '../models/diagram-node.model';
import { IconRegistryService } from './icon-registry.service';
import {
  AZURE_RESOURCE_TYPES,
  STORAGE_SUB_TYPES,
  STORAGE_SERVICE_TYPES,
  StorageSubResourceBuckets,
} from '../constants/azure-resource-types';

@Injectable({ providedIn: 'root' })
export class ResourceMapperService {
  private icons = inject(IconRegistryService);


  mapResources(resources: AzureResource[]): DiagramNode[] {
    // ── Storage: absorb sub-resources into parent before mapping ──────────────
    const storageIdx = new Map<string, StorageSubResourceBuckets>();
    const storageSubIds = new Set<string>();

    for (const r of resources) {
      const typeLower = r.type.toLowerCase();
      // Suppress intermediate service nodes (blobServices/default, etc.)
      if (STORAGE_SERVICE_TYPES.has(typeLower)) {
        storageSubIds.add(r.id);
        continue;
      }
      const bucket = STORAGE_SUB_TYPES[typeLower];
      if (!bucket) continue;

      storageSubIds.add(r.id);

      // Extract parent storage account ID: strip the last 4 path segments
      // e.g. .../storageAccounts/{name}/blobServices/default/containers/{cname}
      //                                 └──────────── 4 segments ────────────┘
      const parts = r.id.split('/');
      const parentId = parts.slice(0, parts.length - 4).join('/');
      const parentKey = parentId.toLowerCase();

      if (!storageIdx.has(parentKey)) {
        storageIdx.set(parentKey, { containers: [], fileShares: [], tables: [], queues: [] });
      }
      storageIdx.get(parentKey)![bucket].push(r.name);
    }

    // Inject storage data into parent properties
    for (const r of resources) {
      if (r.type.toLowerCase() !== AZURE_RESOURCE_TYPES.STORAGE_ACCOUNT) continue;
      const key = r.id.toLowerCase();
      const sub = storageIdx.get(key);
      if (sub) {
        r.properties['_blobContainers'] = sub.containers;
        r.properties['_fileShares']     = sub.fileShares;
        r.properties['_storageTables']  = sub.tables;
        r.properties['_storageQueues']  = sub.queues;
      }
    }

    // Filter out storage sub-resources so they don't become their own nodes
    const mappableResources = resources.filter(r => !storageSubIds.has(r.id));

    const nodes = mappableResources.map(r => this.mapResource(r));
    const nodeById = new Map(nodes.map(n => [n.id.toLowerCase(), n]));
    const claimedVmChildIds = new Set<string>();

    // Build 1 VM container worth of children by attaching VM-related resources.
    const vmResources = resources
      .filter(r => this.isVirtualMachineType(r.type))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const vmResource of vmResources) {
      const vmNode = nodeById.get(vmResource.id.toLowerCase());
      if (!vmNode) continue;

      const relatedIds = new Set<string>(vmNode.children ?? []);
      for (const id of this.collectVmRelatedResourceIds(vmResource, resources)) {
        if (id.toLowerCase() === vmResource.id.toLowerCase()) continue;
        const childNode = nodeById.get(id.toLowerCase());
        if (!childNode) continue;

        // Keep VM group members local to the VM subscription and prevent shared children.
        if (childNode.metadata.subscriptionId !== vmResource.subscriptionId) continue;
        if (this.isVirtualMachineType(childNode.resourceType)) continue;

        const childKey = childNode.id.toLowerCase();
        if (claimedVmChildIds.has(childKey)) continue;

        relatedIds.add(childNode.id);
        claimedVmChildIds.add(childKey);
      }

      vmNode.children = Array.from(relatedIds);
    }

    // Group route resources under their route table parent.
    for (const routeTableResource of resources.filter(r => this.isRouteTableType(r.type))) {
      const routeTableNode = nodeById.get(routeTableResource.id.toLowerCase());
      if (!routeTableNode) continue;

      const relatedIds = new Set<string>(routeTableNode.children ?? []);
      for (const id of this.collectRouteTableRouteIds(routeTableResource, resources)) {
        if (id.toLowerCase() === routeTableResource.id.toLowerCase()) continue;
        if (nodeById.has(id.toLowerCase())) relatedIds.add(id);
      }

      routeTableNode.children = Array.from(relatedIds);
    }

    // Generic nested-resource parent/child mapping:
    // any ARM child resource becomes detachable from its immediate ARM parent.
    for (const resource of mappableResources) {
      const parentId = this.resolveImmediateParentId(resource.id);
      if (!parentId) continue;

      const childNode = nodeById.get(resource.id.toLowerCase());
      const parentNode = nodeById.get(parentId.toLowerCase());
      if (!childNode || !parentNode) continue;
      if (childNode.id.toLowerCase() === parentNode.id.toLowerCase()) continue;
      if (childNode.metadata.subscriptionId !== parentNode.metadata.subscriptionId) continue;

      const nextChildren = new Set(parentNode.children ?? []);
      nextChildren.add(childNode.id);
      parentNode.children = Array.from(nextChildren);
      if (!childNode.parentId) childNode.parentId = parentNode.id;
    }

    return nodes;
  }

  mapResource(resource: AzureResource): DiagramNode {
    const { group, groupId } = this.resolveGroup(resource);
    return {
      id: resource.id,
      label: resource.name,
      resourceType: resource.type.toLowerCase(),
      iconUrl: this.icons.getIconUrl(resource.type),
      group,
      groupId,
      position: { x: 0, y: 0 },
      size: { width: 140, height: 92 },
      children: this.resolveChildren(resource),
      status: this.resolveStatus(resource),
      metadata: resource,
      selected: false,
      highlighted: false,
    };
  }

  resolveGroup(resource: AzureResource): { group: LayoutGroup; groupId: string } {
    const type = resource.type.toLowerCase();
    if (type === AZURE_RESOURCE_TYPES.VIRTUAL_NETWORK) {
      return { group: 'vnet', groupId: resource.id };
    }
    if (type === AZURE_RESOURCE_TYPES.SUBNET) {
      const vnetId = resource.id.split('/subnets/')[0];
      return { group: 'subnet', groupId: vnetId };
    }
    return { group: 'resourceGroup', groupId: resource.resourceGroup };
  }

  private resolveChildren(resource: AzureResource): string[] | undefined {
    const type = resource.type.toLowerCase();
    if (type === AZURE_RESOURCE_TYPES.VIRTUAL_NETWORK) {
      const subnets = (resource.properties['subnets'] as { id: string }[]) ?? [];
      return subnets.map(s => s.id).filter(Boolean);
    }
    return undefined;
  }

  private resolveImmediateParentId(resourceId: string): string | null {
    const parts = resourceId.split('/').filter(Boolean);
    const providersIdx = parts.findIndex(p => p.toLowerCase() === 'providers');
    if (providersIdx < 0) return null;

    const providerTailLen = parts.length - (providersIdx + 1);
    // providers/{namespace}/{type}/{name} is top-level (3 tail segments).
    // Nested resources add another /{type}/{name} pair.
    if (providerTailLen <= 3) return null;
    if (providerTailLen % 2 === 0) return null;

    const parentParts = parts.slice(0, parts.length - 2);
    if (parentParts.length === 0) return null;
    return `/${parentParts.join('/')}`;
  }

  private isVirtualMachineType(type: string): boolean {
    return type.toLowerCase() === AZURE_RESOURCE_TYPES.VIRTUAL_MACHINE;
  }

  private isRouteTableType(type: string): boolean {
    return type.toLowerCase() === AZURE_RESOURCE_TYPES.ROUTE_TABLE;
  }

  private collectVmRelatedResourceIds(vm: AzureResource, resources: AzureResource[]): string[] {
    const ids = new Set<string>();
    const vmIdLower = vm.id.toLowerCase();

    const networkInterfaces = (vm.properties['networkProfile'] as { networkInterfaces?: { id?: string }[] } | undefined)?.networkInterfaces ?? [];
    for (const nic of networkInterfaces) {
      if (nic.id) ids.add(nic.id);
    }

    const storageProfile = vm.properties['storageProfile'] as {
      osDisk?: { managedDisk?: { id?: string } };
      dataDisks?: { managedDisk?: { id?: string } }[];
    } | undefined;

    const osDiskId = storageProfile?.osDisk?.managedDisk?.id;
    if (osDiskId) ids.add(osDiskId);

    for (const disk of storageProfile?.dataDisks ?? []) {
      const diskId = disk.managedDisk?.id;
      if (diskId) ids.add(diskId);
    }

    // Include explicit child resources under the VM ARM ID (extensions, run commands, etc.).
    for (const resource of resources) {
      const idLower = resource.id.toLowerCase();
      if (idLower.startsWith(`${vmIdLower}/`)) {
        ids.add(resource.id);
      }
    }

    return Array.from(ids);
  }

  private collectRouteTableRouteIds(routeTable: AzureResource, resources: AzureResource[]): string[] {
    const ids = new Set<string>();
    const routeTableIdLower = routeTable.id.toLowerCase();

    const routes = (routeTable.properties['routes'] as { id?: string }[] | undefined) ?? [];
    for (const route of routes) {
      if (route.id) ids.add(route.id);
    }

    // Include explicit child resources under the Route Table ARM ID.
    for (const resource of resources) {
      const idLower = resource.id.toLowerCase();
      if (idLower.startsWith(`${routeTableIdLower}/routes/`)) {
        ids.add(resource.id);
      }
    }

    return Array.from(ids);
  }

  private resolveStatus(resource: AzureResource): DiagramNode['status'] {
    const provisioningState = (
      (resource.properties['provisioningState'] as string) ?? ''
    ).toLowerCase();
    if (provisioningState === 'succeeded') return 'running';
    if (provisioningState === 'failed') return 'failed';
    if (provisioningState === 'stopped' || provisioningState === 'deallocated') return 'stopped';
    return 'unknown';
  }
}
