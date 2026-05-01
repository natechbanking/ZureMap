import { buildDiagramState } from './export.service';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';
import { Annotation } from '../models/annotation.model';
import { AzureSubscription } from '../models/azure-resource.model';

describe('buildDiagramState', () => {
  it('builds a versioned diagram state with current timestamp and payload references', () => {
    const nodes: DiagramNode[] = [{
      id: 'n1',
      label: 'vm1',
      resourceType: 'microsoft.compute/virtualmachines',
      iconUrl: '',
      group: 'resourceGroup',
      groupId: 'rg1',
      position: { x: 0, y: 0 },
      size: { width: 120, height: 80 },
      status: 'running',
      selected: false,
      highlighted: false,
      metadata: {
        id: '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1',
        name: 'vm1',
        type: 'Microsoft.Compute/virtualMachines',
        location: 'westeurope',
        resourceGroup: 'rg1',
        subscriptionId: 'sub1',
        tags: {},
        properties: {},
      },
    }];
    const edges: DiagramEdge[] = [{
      id: 'e1',
      sourceId: 'n1',
      targetId: 'n1',
      edgeType: 'privateLink',
      style: { strokeColor: '#0078d4', strokeWidth: 2, markerEnd: 'arrow' },
      animated: false,
    }];
    const subscriptions: AzureSubscription[] = [{
      id: 'sub1',
      subscriptionId: 'sub1',
      name: 'Subscription One',
      state: 'Enabled',
      tenantId: 'tenant-1',
    }];
    const annotations: Annotation[] = [{
      id: 'a1',
      type: 'text',
      color: '#111111',
      strokeWidth: 1,
      fill: 'none',
      x: 10,
      y: 20,
      text: 'hello',
    }];

    const before = Date.now();
    const state = buildDiagramState(nodes, edges, subscriptions, annotations);
    const after = Date.now();

    expect(state.version).toBe('1.0');
    expect(state.nodes).toBe(nodes);
    expect(state.edges).toBe(edges);
    expect(state.subscriptions).toBe(subscriptions);
    expect(state.annotations).toBe(annotations);
    expect(new Date(state.exportedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(state.exportedAt).getTime()).toBeLessThanOrEqual(after + 1000);
  });
});
