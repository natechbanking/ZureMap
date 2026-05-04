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
    customContainerNames: new Map(),
    selectedEdgeId: null,
    ...overrides,
  };
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
});
