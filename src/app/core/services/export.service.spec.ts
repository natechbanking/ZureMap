import { buildDiagramState, ExportService } from './export.service';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';
import { Annotation } from '../models/annotation.model';
import { AzureSubscription } from '../models/azure-resource.model';
import { makeAnnotation, makeDiagramEdge, makeDiagramNode, makeSubscription } from '../../testing/test-helpers';

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

describe('diagram file import', () => {
  const service = new ExportService();

  function diagramFile(state: unknown, embedded = false): File {
    const json = JSON.stringify(state);
    if (!embedded) return new File([json], 'diagram.json', { type: 'application/json' });
    const text = new TextEncoder().encode('zuremap\0' + btoa(unescape(encodeURIComponent(json))));
    const png = new Uint8Array(8 + 12 + text.length);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    new DataView(png.buffer).setUint32(8, text.length);
    png.set(new TextEncoder().encode('tEXt'), 12);
    png.set(text, 16);
    return new File([png], 'diagram.png', { type: 'image/png' });
  }

  it('rejects malformed JSON collections before loading them into the diagram', async () => {
    for (const state of [null, [], { version: '1.0', nodes: {} }, { version: '1.0', edges: 'invalid' },
      { version: '1.0', subscriptions: [null] }, { version: '1.0', annotations: [42] }]) {
      const file = new File([JSON.stringify(state)], 'diagram.json', { type: 'application/json' });
      await expectAsync(service.importFile(file)).toBeRejected();
    }
  });

  it('defaults missing collections when importing older files', async () => {
    const file = new File([JSON.stringify({ version: '1.0', nodes: [] })], 'diagram.json');
    const state = await service.importFile(file);
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.subscriptions).toEqual([]);
    expect(state.annotations).toEqual([]);
  });

  it('rejects malformed collections embedded in a PNG', async () => {
    const file = diagramFile({ version: '1.0', nodes: {} }, true);
    await expectAsync(service.importFile(file)).toBeRejectedWithError('No embedded diagram data found in this PNG');
  });

  it('rejects malformed entries in JSON and embedded PNG imports', async () => {
    const malformed = [
      { nodes: [{}] },
      { nodes: [makeDiagramNode({ position: { x: NaN, y: 0 } })] },
      { nodes: [makeDiagramNode({ children: 'invalid' as unknown as string[] })] },
      { nodes: [{ ...makeDiagramNode(), custom: { internalItems: {} } }] },
      { nodes: [{ ...makeDiagramNode(), custom: { internalItems: [{ id: 'item', text: 'detail', x: 'invalid', y: 0 }] } }] },
      { nodes: [{ ...makeDiagramNode(), ports: {} }] },
      { nodes: [{ ...makeDiagramNode(), ports: [{ id: 'left', side: 'left', offset: 'invalid' }] }] },
      { nodes: [{ ...makeDiagramNode(), costData: { monthlyCostUsd: '1', currency: 'USD', period: 'month' } }] },
      { nodes: [{ ...makeDiagramNode(), custom: { panelState: { vm: 'invalid' } } }] },
      { edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n2' }] },
      { subscriptions: [{ id: 'sub1' }] },
      { annotations: [makeAnnotation({ waypoints: [null] as unknown as { x: number; y: number }[] })] },
      { annotations: [{ ...makeAnnotation(), pathData: 42 }] },
      { annotations: [{ ...makeAnnotation(), sourceBinding: { portId: 42 } }] },
      { annotations: [{ ...makeAnnotation(), container: { kind: 'rg', name: 'rg1', collapsed: 'invalid' } }] },
    ];
    for (const embedded of [false, true]) {
      for (const fields of malformed) {
        await expectAsync(service.importFile(diagramFile({ version: '1.0', ...fields }, embedded))).toBeRejected();
      }
    }
  });

  it('rejects network, local API, and SVG image URLs in both import formats', async () => {
    for (const embedded of [false, true]) {
      for (const imageDataUrl of ['https://tracker.example/pixel', '//tracker.example/pixel', '/api/az/token',
        'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=']) {
        const annotation = makeAnnotation({ type: 'image', imageDataUrl });
        await expectAsync(service.importFile(diagramFile({ version: '1.0', annotations: [annotation] }, embedded))).toBeRejected();
      }
    }
  });

  it('preserves exported nodes, edges, annotations, and embedded raster images in both formats', async () => {
    const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3XcAAAAASUVORK5CYII=';
    const node = makeDiagramNode({ custom: { description: 'Résumé', internalItems: [{ id: 'item', text: 'detail', x: 0, y: 0 }] } });
    const annotations = [makeAnnotation({ text: 'Café ☁' }), makeAnnotation({ id: 'image', type: 'image', imageDataUrl })];
    const state = buildDiagramState([node], [makeDiagramEdge()], [makeSubscription()], annotations);
    for (const embedded of [false, true]) {
      expect(await service.importFile(diagramFile(state, embedded))).toEqual(state);
    }
  });

  it('preserves untagged resources from older Azure scans', async () => {
    const node = makeDiagramNode();
    const state = { version: '1.0', nodes: [{ ...node, metadata: { ...node.metadata, tags: null } }] };
    const imported = await service.importFile(diagramFile(state));
    expect(imported.nodes[0].metadata.tags).toBeNull();
  });
});
