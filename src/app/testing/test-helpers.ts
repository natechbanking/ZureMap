import { Annotation } from '../core/models/annotation.model';
import { AzureResource, AzureSubscription } from '../core/models/azure-resource.model';
import { DiagramEdge } from '../core/models/diagram-edge.model';
import { DiagramNode } from '../core/models/diagram-node.model';

export function makeAzureResource(overrides: Partial<AzureResource> = {}): AzureResource {
  return {
    id: '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1',
    name: 'vm1',
    type: 'Microsoft.Compute/virtualMachines',
    location: 'westeurope',
    resourceGroup: 'rg1',
    subscriptionId: 'sub1',
    tags: {},
    properties: {},
    ...overrides,
  };
}

export function makeDiagramNode(overrides: Partial<DiagramNode> = {}): DiagramNode {
  const metadata = makeAzureResource(overrides.metadata);
  return {
    id: 'n1',
    label: 'node-1',
    resourceType: metadata.type.toLowerCase(),
    iconUrl: '',
    group: 'resourceGroup',
    groupId: metadata.resourceGroup,
    position: { x: 10, y: 20 },
    size: { width: 120, height: 80 },
    status: 'running',
    selected: false,
    highlighted: false,
    metadata,
    ...overrides,
  };
}

export function makeDiagramEdge(overrides: Partial<DiagramEdge> = {}): DiagramEdge {
  return {
    id: 'e1',
    sourceId: 'n1',
    targetId: 'n2',
    edgeType: 'privateLink',
    style: { strokeColor: '#0078d4', strokeWidth: 2, markerEnd: 'arrow' },
    animated: false,
    ...overrides,
  };
}

export function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    type: 'arrow',
    color: '#111111',
    strokeWidth: 2,
    fill: 'none',
    x: 10,
    y: 20,
    x2: 30,
    y2: 40,
    ...overrides,
  };
}

export function makeSubscription(overrides: Partial<AzureSubscription> = {}): AzureSubscription {
  return {
    id: 'sub1',
    subscriptionId: 'sub1',
    name: 'Subscription 1',
    tenantId: 'tenant-1',
    state: 'Enabled',
    ...overrides,
  };
}
