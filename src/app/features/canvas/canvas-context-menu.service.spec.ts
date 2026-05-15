import { TestBed } from '@angular/core/testing';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { CanvasTagVisualizationService } from './canvas-tag-visualization.service';
import { CanvasContextMenuService } from './canvas-context-menu.service';
import { makeDiagramEdge, makeDiagramNode } from '../../testing/test-helpers';

describe('CanvasContextMenuService', () => {
  let service: CanvasContextMenuService;
  let store: DiagramStore;
  let elkLayoutMock: { layout: jasmine.Spy };

  beforeEach(() => {
    elkLayoutMock = {
      layout: jasmine.createSpy('layout').and.resolveTo([]),
    };

    TestBed.configureTestingModule({
      providers: [
        DiagramStore,
        CanvasContextMenuService,
        { provide: ELKLayoutService, useValue: elkLayoutMock },
        { provide: CanvasTagVisualizationService, useValue: { apply: (nodes: unknown[]) => nodes } },
      ],
    });

    service = TestBed.inject(CanvasContextMenuService);
    store = TestBed.inject(DiagramStore);
  });

  it('onSubscriptionContextMenu opens subscription menu in pointer mode and clears other menus', () => {
    service.contextMenu = { nodeId: 'n1', x: 1, y: 2, node: makeDiagramNode({ id: 'n1' }) };
    service.rgContextMenu = { x: 3, y: 4, id: 'sub1::rg1', name: 'rg1' };
    service.annotationContextMenu = { x: 5, y: 6, annotationId: 'ann1' };

    const event = {
      clientX: 77,
      clientY: 88,
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as unknown as MouseEvent;

    service.onSubscriptionContextMenu(
      event,
      {
        id: 'sub1',
        subscriptionId: 'sub1',
        name: 'Subscription A',
        collapsed: false,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      'pointer',
    );

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(service.contextMenu).toBeNull();
    expect(service.rgContextMenu).toBeNull();
    expect(service.annotationContextMenu).toBeNull();
    expect(service.subscriptionContextMenu).toEqual({
      x: 77,
      y: 88,
      id: 'sub1',
      name: 'Subscription A',
    });
  });

  it('onSubscriptionContextMenu does nothing when active tool is not pointer', () => {
    const event = {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as unknown as MouseEvent;

    service.onSubscriptionContextMenu(
      event,
      {
        id: 'sub1',
        subscriptionId: 'sub1',
        name: 'Subscription A',
        collapsed: false,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      'rect',
    );

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(service.subscriptionContextMenu).toBeNull();
  });

  it('ctxSubscriptionAutoLayout is a no-op when no subscription context menu exists', async () => {
    await service.ctxSubscriptionAutoLayout();
    expect(elkLayoutMock.layout).not.toHaveBeenCalled();
  });

  it('autoLayoutSubscriptionContainer no-ops when fewer than two nodes match subscription', async () => {
    store.setNodes([
      makeDiagramNode({ id: 'n1', metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub1' } }),
      makeDiagramNode({ id: 'n2', metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub2' } }),
    ]);

    await service.autoLayoutSubscriptionContainer('sub1');

    expect(elkLayoutMock.layout).not.toHaveBeenCalled();
  });

  it('autoLayoutSubscriptionContainer repositions only nodes in target subscription', async () => {
    const subNode1 = makeDiagramNode({
      id: 'a',
      position: { x: 100, y: 100 },
      metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub1' },
    });
    const subNode2 = makeDiagramNode({
      id: 'b',
      position: { x: 220, y: 180 },
      metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub1' },
    });
    const otherNode = makeDiagramNode({
      id: 'c',
      position: { x: 500, y: 500 },
      metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub2' },
    });
    store.setNodes([subNode1, subNode2, otherNode]);
    store.setEdges([makeDiagramEdge({ id: 'e1', sourceId: 'a', targetId: 'b' })]);

    elkLayoutMock.layout.and.resolveTo([
      { ...subNode1, position: { x: 10, y: 10 } },
      { ...subNode2, position: { x: 40, y: 25 } },
    ]);

    await service.autoLayoutSubscriptionContainer('sub1');

    const updated = store.nodes();
    expect(elkLayoutMock.layout).toHaveBeenCalled();
    expect(updated.find(n => n.id === 'a')?.position).toEqual({ x: 100, y: 100 });
    expect(updated.find(n => n.id === 'b')?.position).toEqual({ x: 130, y: 115 });
    expect(updated.find(n => n.id === 'c')?.position).toEqual({ x: 500, y: 500 });
    expect(service.relayoutBusy).toBeFalse();
  });

  it('ctxSubscriptionAutoLayout runs and closes menu', async () => {
    spyOn(service, 'autoLayoutSubscriptionContainer').and.resolveTo();
    service.subscriptionContextMenu = { x: 1, y: 2, id: 'sub1', name: 'Subscription A' };

    await service.ctxSubscriptionAutoLayout();

    expect(service.autoLayoutSubscriptionContainer).toHaveBeenCalledWith('sub1');
    expect(service.subscriptionContextMenu).toBeNull();
  });
});
