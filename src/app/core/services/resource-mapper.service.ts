import { Injectable } from '@angular/core';
import { AzureResource } from '../models/azure-resource.model';
import { DiagramNode, LayoutGroup } from '../models/diagram-node.model';
import { IconRegistryService } from './icon-registry.service';

@Injectable({ providedIn: 'root' })
export class ResourceMapperService {
  constructor(private icons: IconRegistryService) {}

  mapResources(resources: AzureResource[]): DiagramNode[] {
    return resources.map(r => this.mapResource(r));
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
      size: { width: 140, height: 80 },
      children: this.resolveChildren(resource),
      isPinned: false,
      status: this.resolveStatus(resource),
      metadata: resource,
      selected: false,
      highlighted: false,
    };
  }

  resolveGroup(resource: AzureResource): { group: LayoutGroup; groupId: string } {
    const type = resource.type.toLowerCase();
    if (type === 'microsoft.network/virtualnetworks') {
      return { group: 'vnet', groupId: resource.id };
    }
    if (type === 'microsoft.network/subnets') {
      const vnetId = resource.id.split('/subnets/')[0];
      return { group: 'subnet', groupId: vnetId };
    }
    return { group: 'resourceGroup', groupId: resource.resourceGroup };
  }

  private resolveChildren(resource: AzureResource): string[] | undefined {
    const type = resource.type.toLowerCase();
    if (type === 'microsoft.network/virtualnetworks') {
      const subnets = (resource.properties['subnets'] as Array<{ id: string }>) ?? [];
      return subnets.map(s => s.id).filter(Boolean);
    }
    return undefined;
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
