import { TestBed } from '@angular/core/testing';
import { CanvasVisibilityService, VisibilityInput } from './canvas-visibility.service';
import { makeAzureResource, makeDiagramEdge, makeDiagramNode } from '../../testing/test-helpers';

function makeInput(overrides: Partial<VisibilityInput> = {}): VisibilityInput {
  return {
    nodes: [],
    edges: [],
    activeSubscriptions: [],
    collapsedSubscriptions: new Set(),
    collapsedResourceGroups: new Set(),
    collapsedVmGroups: new Set(),
    collapsedRouteTableGroups: new Set(),
    collapsedK8sNamespaces: new Set(),
    collapsedK8sScopes: new Set(),
    collapsedK8sClusters: new Set(),
    customContainerNames: new Map(),
    selectedEdgeId: null,
    ...overrides,
  };
}

function makeK8sNode(overrides: Partial<Parameters<typeof makeDiagramNode>[0]> = {}) {
  return makeDiagramNode({
    group: 'k8sNamespace',
    metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }),
    ...overrides,
  });
}

describe('CanvasVisibilityService', () => {
  let service: CanvasVisibilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CanvasVisibilityService] });
    service = TestBed.inject(CanvasVisibilityService);
  });

  describe('annotation-connected edge visibility', () => {
    it('keeps edges whose source is an annotation (sourceAnnotationId set, sourceId empty)', () => {
      const n = makeDiagramNode({ id: 'n1' });
      const edge = makeDiagramEdge({
        id: 'e1',
        sourceId: '',
        sourceAnnotationId: 'ann-1',
        targetId: 'n1',
      });

      const result = service.derive(makeInput({ nodes: [n], edges: [edge] }));

      expect(result.visibleEdges.length).toBe(1);
      expect(result.visibleEdges[0].id).toBe('e1');
    });

    it('keeps edges whose target is an annotation (targetAnnotationId set, targetId empty)', () => {
      const n = makeDiagramNode({ id: 'n1' });
      const edge = makeDiagramEdge({
        id: 'e1',
        sourceId: 'n1',
        targetId: '',
        targetAnnotationId: 'ann-2',
      });

      const result = service.derive(makeInput({ nodes: [n], edges: [edge] }));

      expect(result.visibleEdges.length).toBe(1);
      expect(result.visibleEdges[0].id).toBe('e1');
    });

    it('keeps annotation-to-annotation edges (both endpoints are annotations)', () => {
      const edge = makeDiagramEdge({
        id: 'e1',
        sourceId: '',
        sourceAnnotationId: 'ann-1',
        targetId: '',
        targetAnnotationId: 'ann-2',
      });

      const result = service.derive(makeInput({ nodes: [], edges: [edge] }));

      expect(result.visibleEdges.length).toBe(1);
    });

    it('filters out node-to-node edges when either node is not visible', () => {
      const n1 = makeDiagramNode({ id: 'n1' });
      const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'missing-node' });

      const result = service.derive(makeInput({ nodes: [n1], edges: [edge] }));

      expect(result.visibleEdges.length).toBe(0);
    });

    it('includes a node-to-node edge when both nodes are visible', () => {
      const n1 = makeDiagramNode({ id: 'n1' });
      const n2 = makeDiagramNode({ id: 'n2' });
      const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });

      const result = service.derive(makeInput({ nodes: [n1, n2], edges: [edge] }));

      expect(result.visibleEdges.length).toBe(1);
    });

    it('marks selectedEdgeVisible false when selected edge is filtered out', () => {
      const n1 = makeDiagramNode({ id: 'n1' });
      const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'missing' });

      const result = service.derive(makeInput({ nodes: [n1], edges: [edge], selectedEdgeId: 'e1' }));

      expect(result.selectedEdgeVisible).toBeFalse();
    });

    it('marks selectedEdgeVisible true when selected annotation edge is visible', () => {
      const n1 = makeDiagramNode({ id: 'n1' });
      const edge = makeDiagramEdge({
        id: 'e1',
        sourceId: '',
        sourceAnnotationId: 'ann-1',
        targetId: 'n1',
      });

      const result = service.derive(makeInput({ nodes: [n1], edges: [edge], selectedEdgeId: 'e1' }));

      expect(result.selectedEdgeVisible).toBeTrue();
    });
  });

  describe('subscription collapse', () => {
    it('hides nodes from a collapsed subscription', () => {
      const nodeWithSub = makeDiagramNode({
        id: 'n1',
        metadata: makeAzureResource({ subscriptionId: 'sub-1' }),
      });

      const result = service.derive(makeInput({
        nodes: [nodeWithSub],
        collapsedSubscriptions: new Set(['sub-1']),
      }));

      expect(result.visibleNodes.length).toBe(0);
    });
  });

  describe('K8s namespace collapse', () => {
    it('hides only nodes in the collapsed namespace', () => {
      const nsA = makeK8sNode({ id: 'n-a', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const nsB = makeK8sNode({ id: 'n-b', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-b' }) });

      const result = service.derive(makeInput({
        nodes: [nsA, nsB],
        collapsedK8sNamespaces: new Set(['scope-1::ns-a']),
      }));

      expect(result.visibleNodes.map(n => n.id)).toEqual(['n-b']);
    });

    it('keeps all namespace nodes visible when nothing is collapsed', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const n2 = makeK8sNode({ id: 'n2', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-b' }) });

      const result = service.derive(makeInput({ nodes: [n1, n2] }));

      expect(result.visibleNodes.length).toBe(2);
    });

    it('hides edges when both endpoints are in a collapsed namespace', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const n2 = makeK8sNode({ id: 'n2', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });

      const result = service.derive(makeInput({
        nodes: [n1, n2],
        edges: [edge],
        collapsedK8sNamespaces: new Set(['scope-1::ns-a']),
      }));

      expect(result.visibleEdges.length).toBe(0);
    });
  });

  describe('K8s scope collapse', () => {
    it('hides all namespace nodes when their scope is collapsed', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const n2 = makeK8sNode({ id: 'n2', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-b' }) });
      const n3 = makeK8sNode({ id: 'n3', metadata: makeAzureResource({ subscriptionId: 'scope-2', resourceGroup: 'ns-c' }) });

      const result = service.derive(makeInput({
        nodes: [n1, n2, n3],
        collapsedK8sScopes: new Set(['scope-1']),
      }));

      expect(result.visibleNodes.map(n => n.id)).toEqual(['n3']);
    });

    it('hides all edges to nodes in a collapsed scope', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const n2 = makeK8sNode({ id: 'n2', metadata: makeAzureResource({ subscriptionId: 'scope-2', resourceGroup: 'ns-b' }) });
      const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });

      const result = service.derive(makeInput({
        nodes: [n1, n2],
        edges: [edge],
        collapsedK8sScopes: new Set(['scope-1']),
      }));

      expect(result.visibleEdges.length).toBe(0);
    });
  });

  describe('K8s cluster collapse', () => {
    it('hides all k8sNamespace nodes when the synthetic cluster is collapsed', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const n2 = makeK8sNode({ id: 'n2', metadata: makeAzureResource({ subscriptionId: 'scope-2', resourceGroup: 'ns-b' }) });
      const azureNode = makeDiagramNode({ id: 'az1', group: 'resourceGroup' });

      const result = service.derive(makeInput({
        nodes: [n1, n2, azureNode],
        collapsedK8sClusters: new Set(['__k8s-cluster__']),
      }));

      // Azure nodes are unaffected; K8s nodes are hidden
      expect(result.visibleNodes.map(n => n.id)).toEqual(['az1']);
    });

    it('does not hide k8sNamespace nodes when cluster collapse set is empty', () => {
      const n1 = makeK8sNode({ id: 'n1' });

      const result = service.derive(makeInput({
        nodes: [n1],
        collapsedK8sClusters: new Set(),
      }));

      expect(result.visibleNodes.length).toBe(1);
    });

    it('produces k8sClusterBounds with collapsed flag when cluster is collapsed', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: '', resourceGroup: 'ns-a' }) });

      const result = service.derive(makeInput({
        nodes: [n1],
        collapsedK8sClusters: new Set(['__k8s-cluster__']),
      }));

      // Namespace bounds still computed (cluster collapse only hides nodes, not bounds)
      expect(result.k8sNamespaceBounds.length).toBe(1);
      expect(result.k8sClusterBounds.length).toBe(1);
      expect(result.k8sClusterBounds[0].collapsed).toBeTrue();
    });

    it('hides edges when both endpoints are in K8s nodes that are hidden by cluster collapse', () => {
      const n1 = makeK8sNode({ id: 'n1', metadata: makeAzureResource({ subscriptionId: 'scope-1', resourceGroup: 'ns-a' }) });
      const n2 = makeK8sNode({ id: 'n2', metadata: makeAzureResource({ subscriptionId: 'scope-2', resourceGroup: 'ns-b' }) });
      const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });

      const result = service.derive(makeInput({
        nodes: [n1, n2],
        edges: [edge],
        collapsedK8sClusters: new Set(['__k8s-cluster__']),
      }));

      expect(result.visibleEdges.length).toBe(0);
    });
  });
});
