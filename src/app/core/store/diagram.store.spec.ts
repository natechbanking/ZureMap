import { TestBed } from '@angular/core/testing';
import { DiagramStore } from './diagram.store';
import { makeAnnotation, makeDiagramEdge, makeDiagramNode } from '../../testing/test-helpers';

describe('DiagramStore', () => {
  let store: DiagramStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DiagramStore],
    });
    store = TestBed.inject(DiagramStore);
  });

  it('clearDiagram clears nodes, edges, annotations, tag rules, and custom names', () => {
    const node = makeDiagramNode();
    const edge = makeDiagramEdge({ targetId: 'n1', animated: true });
    const ann = makeAnnotation();

    store.setNodes([node]);
    store.setEdges([edge]);
    store.setAnnotations([ann]);
    store.tagRules.set([{
      id: 'rule-1',
      type: 'tag',
      tagKey: 'env',
      operator: 'eq',
      tagValue: 'prod',
      target: 'node',
      color: '#ef4444',
    }]);
    store.setCustomContainerName('rg::sub1::rg1', 'Production RG');

    store.clearDiagram();

    expect(store.nodes()).toEqual([]);
    expect(store.edges()).toEqual([]);
    expect(store.annotations()).toEqual([]);
    expect(store.tagRules()).toEqual([]);
    expect(store.customContainerNames().size).toBe(0);
  });

  it('increments revision for committed mutations and clearDiagram', () => {
    const startRevision = store.revision();
    store.setAnnotations([]);
    const afterSetAnnotations = store.revision();
    store.clearDiagram();
    const afterClear = store.revision();

    expect(afterSetAnnotations).toBe(startRevision + 1);
    expect(afterClear).toBe(afterSetAnnotations + 1);
  });

  it('supports undo/redo snapshots across node mutations', () => {
    const node = makeDiagramNode({ id: 'n1' });
    store.setNodes([node]);
    store.pushUndo();
    store.moveNode('n1', { x: 99, y: 77 });

    expect(store.nodes()[0].position).toEqual({ x: 99, y: 77 });
    expect(store.canUndo()).toBeTrue();

    store.undo();
    expect(store.nodes()[0].position).toEqual({ x: 10, y: 20 });
    expect(store.canRedo()).toBeTrue();

    store.redo();
    expect(store.nodes()[0].position).toEqual({ x: 99, y: 77 });
  });

  it('moveSubscriptionGroup clamps coordinates to non-negative values', () => {
    const node = makeDiagramNode({
      id: 'n1',
      position: { x: 3, y: 4 },
      metadata: {
        ...makeDiagramNode().metadata,
        subscriptionId: 'subX',
      },
    });
    store.setNodes([node]);

    store.moveSubscriptionGroup('subX', { dx: -10, dy: -10 });

    expect(store.nodes()[0].position).toEqual({ x: 0, y: 0 });
  });

  it('select/toggle selection updates selected flags and sidebar state', () => {
    const n1 = makeDiagramNode({ id: 'n1' });
    const n2 = makeDiagramNode({ id: 'n2' });
    store.setNodes([n1, n2]);

    store.selectNodes(['n1']);
    expect(store.selectedNodeId()).toBe('n1');
    expect(store.sidebarOpen()).toBeTrue();
    expect(store.nodes().find(n => n.id === 'n1')?.selected).toBeTrue();

    store.toggleNodeInSelection('n2');
    expect(store.selectedNodeIds()).toEqual(['n1', 'n2']);
    expect(store.selectedNodeId()).toBeNull();

    store.selectNode(null);
    expect(store.selectedNodeIds()).toEqual([]);
    expect(store.sidebarOpen()).toBeFalse();
  });

  it('deleteNode removes node, related edges, and parent child linkage', () => {
    const parent = makeDiagramNode({ id: 'parent', children: ['child'] });
    const child = makeDiagramNode({ id: 'child', parentId: 'parent' });
    const edge = makeDiagramEdge({ id: 'e1', sourceId: 'parent', targetId: 'child' });
    store.setNodes([parent, child]);
    store.setEdges([edge]);
    store.selectNodes(['child']);

    store.deleteNode('child');

    expect(store.nodes().map(n => n.id)).toEqual(['parent']);
    expect(store.nodes()[0].children).toEqual([]);
    expect(store.edges()).toEqual([]);
    expect(store.selectedNodeIds()).toEqual([]);
  });

  it('deleteSelectedNodes removes all selected nodes and connecting edges', () => {
    const a = makeDiagramNode({ id: 'a', children: ['b', 'c'] });
    const b = makeDiagramNode({ id: 'b', parentId: 'a' });
    const c = makeDiagramNode({ id: 'c', parentId: 'a' });
    const d = makeDiagramNode({ id: 'd' });
    store.setNodes([a, b, c, d]);
    store.setEdges([
      makeDiagramEdge({ id: 'e1', sourceId: 'a', targetId: 'b' }),
      makeDiagramEdge({ id: 'e2', sourceId: 'c', targetId: 'd' }),
    ]);
    store.selectNodes(['b', 'c']);

    store.deleteSelectedNodes();

    expect(store.nodes().map(n => n.id).sort()).toEqual(['a', 'd']);
    expect(store.nodes().find(n => n.id === 'a')?.children).toEqual([]);
    expect(store.edges()).toEqual([]);
  });

  it('reattach/detach parent relationships mutate child sets correctly', () => {
    const p1 = makeDiagramNode({ id: 'p1', children: [] });
    const p2 = makeDiagramNode({ id: 'p2', children: [] });
    const child = makeDiagramNode({ id: 'c1' });
    store.setNodes([p1, p2, child]);

    store.reattachNodeToParent('c1', 'p1');
    expect(store.nodes().find(n => n.id === 'p1')?.children).toEqual(['c1']);
    expect(store.nodes().find(n => n.id === 'c1')?.parentId).toBe('p1');

    store.detachNodeFromParent('c1', 'p1');
    expect(store.nodes().find(n => n.id === 'p1')?.children).toEqual([]);
    expect(store.nodes().find(n => n.id === 'c1')?.parentId).toBe('p1');

    store.reattachNodeToParent('c1', 'p2');
    expect(store.nodes().find(n => n.id === 'p2')?.children).toEqual(['c1']);
  });

  it('moveVmGroup moves vm and listed children together with clamping', () => {
    const vm = makeDiagramNode({ id: 'vm1', position: { x: 5, y: 5 }, children: ['nic1'] });
    const nic = makeDiagramNode({ id: 'nic1', position: { x: 6, y: 6 } });
    const other = makeDiagramNode({ id: 'other', position: { x: 20, y: 20 } });
    store.setNodes([vm, nic, other]);

    store.moveVmGroup('vm1', { dx: -10, dy: 3 });

    expect(store.nodes().find(n => n.id === 'vm1')?.position).toEqual({ x: 0, y: 8 });
    expect(store.nodes().find(n => n.id === 'nic1')?.position).toEqual({ x: 0, y: 9 });
    expect(store.nodes().find(n => n.id === 'other')?.position).toEqual({ x: 20, y: 20 });
  });

  it('reattach/detach resource group keeps standalone and restores rg grouping', () => {
    const node = makeDiagramNode({
      id: 'n-rg',
      group: 'resourceGroup',
      groupId: 'rg1',
      metadata: { ...makeDiagramNode().metadata, resourceGroup: 'rg1' },
    });
    store.setNodes([node]);

    store.detachNodeFromResourceGroup('n-rg');
    expect(store.nodes()[0].group).toBe('standalone');
    expect(store.nodes()[0].groupId).toBe('n-rg');

    store.reattachNodeToResourceGroup('n-rg');
    expect(store.nodes()[0].group).toBe('resourceGroup');
    expect(store.nodes()[0].groupId).toBe('rg1');
  });
});
