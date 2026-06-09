import { signal, WritableSignal, ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanvasComponent } from './canvas.component';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import { CanvasActionsService } from './canvas-actions.service';
import { CanvasEdgeEditorService } from './canvas-edge-editor.service';
import { CanvasResourceEditorService } from './canvas-resource-editor.service';
import { CanvasVisibilityService } from './canvas-visibility.service';
import { CanvasCollapseService } from './canvas-collapse.service';
import { CanvasAnnotationService } from './canvas-annotation.service';
import { CanvasDragService } from './canvas-drag.service';
import { CanvasOverlapService } from './canvas-overlap.service';
import { CanvasNodeExpansionService } from './canvas-node-expansion.service';
import { CanvasTagVisualizationService } from './canvas-tag-visualization.service';
import { CanvasContextMenuService } from './canvas-context-menu.service';
import { AutosaveService } from '../../core/services/autosave.service';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { makeAnnotation, makeAzureResource, makeDiagramEdge, makeDiagramNode } from '../../testing/test-helpers';

describe('CanvasComponent', () => {
  let component: CanvasComponent;
  let store: DiagramStore;
  let autosaveMock: { enabled: WritableSignal<boolean>; queueSave: jasmine.Spy };
  let ctxMenuSvcMock: {
    closeContextMenu: jasmine.Spy;
    annotationContextMenu: { x: number; y: number; annotationId: string } | null;
    contextMenu: { x: number; y: number; nodeId: string } | null;
    rgContextMenu: { x: number; y: number; id: string; name: string } | null;
    subscriptionContextMenu: { x: number; y: number; id: string; name: string } | null;
    multiSelectContextMenu: { x: number; y: number } | null;
    onContextMenuRequested: jasmine.Spy;
    onRgContextMenu: jasmine.Spy;
    onSubscriptionContextMenu: jasmine.Spy;
    ctxSubscriptionAutoLayout: jasmine.Spy;
  };

  beforeEach(() => {
    autosaveMock = {
      enabled: signal(false),
      queueSave: jasmine.createSpy('queueSave'),
    };
    ctxMenuSvcMock = {
      closeContextMenu: jasmine.createSpy('closeContextMenu'),
      annotationContextMenu: null,
      contextMenu: null,
      rgContextMenu: null,
      subscriptionContextMenu: null,
      multiSelectContextMenu: null,
      onContextMenuRequested: jasmine.createSpy('onContextMenuRequested'),
      onRgContextMenu: jasmine.createSpy('onRgContextMenu'),
      onSubscriptionContextMenu: jasmine.createSpy('onSubscriptionContextMenu'),
      ctxSubscriptionAutoLayout: jasmine.createSpy('ctxSubscriptionAutoLayout').and.resolveTo(),
    };

    TestBed.configureTestingModule({
      providers: [
        DiagramStore,
        { provide: ELKLayoutService, useValue: { layout: jasmine.createSpy('layout').and.resolveTo([]) } },
        { provide: IconRegistryService, useValue: { getIconUrl: () => '' } },
        { provide: CanvasActionsService, useValue: {} },
        { provide: CanvasEdgeEditorService, useValue: { getSelectedEdge: () => null } },
        { provide: CanvasResourceEditorService, useValue: {} },
        {
          provide: CanvasVisibilityService,
          useValue: {
            derive: () => ({
              visibleNodes: [],
              visibleEdges: [],
              rgBounds: [],
              subscriptionBounds: [],
              vmBounds: [],
              routeTableBounds: [],
              selectedEdgeVisible: true,
            }),
          },
        },
        { provide: CanvasCollapseService, useValue: {} },
        CanvasAnnotationService,
        { provide: CanvasDragService, useValue: { onDocumentMouseMove: () => ({ handled: false }) } },
        { provide: CanvasOverlapService, useValue: { resolveSubscriptionContainerOverlaps: () => undefined } },
        { provide: CanvasNodeExpansionService, useValue: { apply: () => null } },
        { provide: CanvasTagVisualizationService, useValue: {} },
        { provide: CanvasContextMenuService, useValue: ctxMenuSvcMock },
        { provide: AutosaveService, useValue: autosaveMock },
        { provide: ChangeDetectorRef, useValue: { markForCheck: jasmine.createSpy('markForCheck'), detectChanges: jasmine.createSpy('detectChanges'), detach: jasmine.createSpy('detach'), reattach: jasmine.createSpy('reattach') } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new CanvasComponent());
    store = TestBed.inject(DiagramStore);
  });

  function setCanvasHost(): void {
    const host = document.createElement('div');
    Object.defineProperty(host, 'scrollLeft', { value: 0, writable: true });
    Object.defineProperty(host, 'scrollTop', { value: 0, writable: true });
    host.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    component.canvasHostRef = { nativeElement: host } as unknown as typeof component.canvasHostRef;
  }

  it('Ctrl+Z triggers exactly one store.undo call', () => {
    const undoSpy = spyOn(store, 'undo');
    const event = {
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      key: 'z',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent;

    component.onKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(undoSpy).toHaveBeenCalledTimes(1);
  });

  it('copies and pastes selected annotation via Ctrl+C / Ctrl+V', () => {
    store.setAnnotations([
      makeAnnotation({ id: 'ann-1', type: 'text', text: 'hello', x: 10, y: 20 }),
    ]);
    component.selectedAnnotationId = 'ann-1';
    component.selectedAnnotationIds = ['ann-1'];

    const copyEvent = {
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent;
    component.onKeyDown(copyEvent);

    const pastedFromClipboard = component.pasteCanvasClipboard();

    const annotations = store.annotations();
    expect(copyEvent.preventDefault).toHaveBeenCalled();
    expect(pastedFromClipboard).toBeTrue();
    expect(annotations.length).toBe(2);
    const pasted = annotations.find(a => a.id !== 'ann-1');
    expect(pasted).toBeDefined();
    expect(pasted?.x).toBe(34);
    expect(pasted?.y).toBe(44);
  });

  it('closes context menu after successful copy from context menu selection', () => {
    const node = makeDiagramNode({ id: 'node-1' });
    store.setNodes([node]);
    ctxMenuSvcMock.contextMenu = { x: 10, y: 20, nodeId: 'node-1' };

    const copied = component.copySelectedCanvasObject();

    expect(copied).toBeTrue();
    expect(ctxMenuSvcMock.closeContextMenu).toHaveBeenCalled();
  });

  it('copies context-menu node instead of stale annotation selection', () => {
    const node = makeDiagramNode({ id: 'node-1', position: { x: 10, y: 20 } });
    const annotation = makeAnnotation({ id: 'ann-1', type: 'text', text: 'hello', x: 5, y: 6 });
    store.setNodes([node]);
    store.setAnnotations([annotation]);
    component.selectedAnnotationId = 'ann-1';
    component.selectedAnnotationIds = ['ann-1'];
    ctxMenuSvcMock.contextMenu = { x: 10, y: 20, nodeId: 'node-1' };

    const copied = component.copySelectedCanvasObject();
    const pasted = component.pasteCanvasClipboard();

    expect(copied).toBeTrue();
    expect(pasted).toBeTrue();
    expect(component.canPasteNodeObjects).toBeTrue();
    expect(store.nodes().length).toBe(2);
    expect(store.annotations().length).toBe(1);
  });

  it('resets paste offset sequence when clipboard content is refreshed by copy', () => {
    store.setAnnotations([
      makeAnnotation({ id: 'ann-1', type: 'text', text: 'first', x: 10, y: 20 }),
      makeAnnotation({ id: 'ann-2', type: 'text', text: 'second', x: 100, y: 200 }),
    ]);

    component.selectedAnnotationId = 'ann-1';
    component.selectedAnnotationIds = ['ann-1'];
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();
    expect(component.pasteCanvasClipboard()).toBeTrue();

    component.selectedAnnotationId = 'ann-2';
    component.selectedAnnotationIds = ['ann-2'];
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();

    const pastedFromSecond = store.annotations()
      .filter(a => a.id !== 'ann-1' && a.id !== 'ann-2')
      .find(a => a.text === 'second' && a.x === 124 && a.y === 224);

    expect(pastedFromSecond).toBeDefined();
  });

  it('copies selected nodes and selected-to-selected edges and pastes with remapped ids', () => {
    const n1 = makeDiagramNode({ id: 'n1', position: { x: 10, y: 20 } });
    const n2 = makeDiagramNode({ id: 'n2', position: { x: 30, y: 40 } });
    const e1 = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });
    store.setNodes([n1, n2]);
    store.setEdges([e1]);
    store.selectNodes(['n1', 'n2']);

    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();

    expect(store.nodes().length).toBe(4);
    expect(store.edges().length).toBe(2);
    const copiedNodes = store.nodes().filter(n => n.id !== 'n1' && n.id !== 'n2');
    expect(copiedNodes.length).toBe(2);
    expect(copiedNodes.every(n => n.position.x >= 34 && n.position.y >= 44)).toBeTrue();
    const copiedEdge = store.edges().find(e => e.id !== 'e1');
    expect(copiedEdge).toBeDefined();
    expect(copiedNodes.some(n => n.id === copiedEdge?.sourceId)).toBeTrue();
    expect(copiedNodes.some(n => n.id === copiedEdge?.targetId)).toBeTrue();
  });

  it('clears parentId when parent is not part of copied selection', () => {
    const parent = makeDiagramNode({ id: 'parent' });
    const child = makeDiagramNode({ id: 'child', parentId: 'parent' });
    store.setNodes([parent, child]);
    store.selectNodes(['child']);

    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();

    const pasted = store.nodes().find(n => n.id !== 'parent' && n.id !== 'child');
    expect(pasted).toBeDefined();
    expect(pasted?.parentId).toBeUndefined();
  });

  it('drops children references that are not part of copied selection', () => {
    const child = makeDiagramNode({ id: 'child' });
    const container = makeDiagramNode({ id: 'container', children: ['child'] });
    store.setNodes([container, child]);
    store.selectNodes(['container']);

    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();

    const pasted = store.nodes().find(n => n.id !== 'container' && n.id !== 'child');
    expect(pasted).toBeDefined();
    expect(pasted?.children ?? []).toEqual([]);
  });

  it('remaps groupId when it points to a copied node id', () => {
    const vnet = makeDiagramNode({
      id: 'vnet-1',
      group: 'vnet',
      groupId: 'vnet-1',
    });
    const subnet = makeDiagramNode({
      id: 'subnet-1',
      group: 'subnet',
      groupId: 'vnet-1',
    });
    store.setNodes([vnet, subnet]);
    store.selectNodes(['vnet-1', 'subnet-1']);

    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();

    const pastedNodes = store.nodes().filter(n => n.id !== 'vnet-1' && n.id !== 'subnet-1');
    expect(pastedNodes.length).toBe(2);
    const pastedVnet = pastedNodes.find(n => n.group === 'vnet');
    const pastedSubnet = pastedNodes.find(n => n.group === 'subnet');
    expect(pastedVnet).toBeDefined();
    expect(pastedSubnet).toBeDefined();
    expect(pastedVnet?.groupId).toBe(pastedVnet?.id);
    expect(pastedSubnet?.groupId).toBe(pastedVnet?.id);
  });

  it('preserves metadata.id on pasted nodes while assigning new diagram ids', () => {
    const armId = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Network/virtualNetworks/vnet1';
    const node = makeDiagramNode({
      id: 'node-1',
      metadata: makeAzureResource({ id: armId }),
    });
    store.setNodes([node]);
    store.selectNodes(['node-1']);

    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    expect(component.pasteCanvasClipboard()).toBeTrue();

    const pasted = store.nodes().find(n => n.id !== 'node-1');
    expect(pasted).toBeDefined();
    expect(pasted?.id).not.toBe('node-1');
    expect(pasted?.metadata.id).toBe(armId);
  });

  describe('port-based edge creation', () => {
    it('onPortMouseDown initialises edgeLinkDragState with source node and port', () => {
      const node = makeDiagramNode({ id: 'n1', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const event = { preventDefault: jasmine.createSpy(), stopPropagation: jasmine.createSpy() } as unknown as MouseEvent;

      component.onPortMouseDown(event, node, 'port-right');

      expect(component.edgeLinkDragState).toBeTruthy();
      expect(component.edgeLinkDragState?.sourceNodeId).toBe('n1');
      expect(component.edgeLinkDragState?.sourcePortId).toBe('port-right');
      expect(component.edgeLinkDragState?.sourceX).toBe(100); // right-center x
      expect(component.edgeLinkDragState?.sourceY).toBe(30);  // right-center y
    });

    it('onPortMouseDown does nothing for unknown port id', () => {
      const node = makeDiagramNode({ id: 'n1', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const event = { preventDefault: jasmine.createSpy(), stopPropagation: jasmine.createSpy() } as unknown as MouseEvent;

      component.onPortMouseDown(event, node, 'port-invalid');

      expect(component.edgeLinkDragState).toBeNull();
    });

    it('onAnnPortMouseDown initialises edgeLinkDragState with source annotation and port', () => {
      const ann = makeAnnotation({ id: 'ann-1', type: 'rect', x: 0, y: 0, width: 80, height: 60 });
      const event = { preventDefault: jasmine.createSpy(), stopPropagation: jasmine.createSpy() } as unknown as MouseEvent;

      component.onAnnPortMouseDown(event, ann, 'port-bottom');

      expect(component.edgeLinkDragState).toBeTruthy();
      expect(component.edgeLinkDragState?.sourceAnnotationId).toBe('ann-1');
      expect(component.edgeLinkDragState?.sourceNodeId).toBeUndefined();
      expect(component.edgeLinkDragState?.sourcePortId).toBe('port-bottom');
      expect(component.edgeLinkDragState?.sourceY).toBe(60); // bottom-center y
    });

    it('onDocMouseUp creates an edge when drag ends over a valid target port', () => {
      // n1 at (0,0) 100×60 — port-right is at (100, 30)
      // n2 at (120,0) 100×60 — port-left is at (120, 30); within HIT_R=12 of (120,30)
      const n1 = makeDiagramNode({ id: 'n1', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const n2 = makeDiagramNode({ id: 'n2', position: { x: 120, y: 0 }, size: { width: 100, height: 60 } });
      store.setNodes([n1, n2]);

      component.edgeLinkDragState = {
        sourceNodeId: 'n1',
        sourcePortId: 'port-right',
        sourceX: 100,
        sourceY: 30,
        currentX: 100,
        currentY: 30,
      };

      // canvasPointFromClient returns {x:0,y:0} when hostRef is null, so place the
      // target port at origin: n2 at (0, -30) makes port-left land at (0,0).
      const n2Shifted = makeDiagramNode({ id: 'n2', position: { x: 0, y: -30 }, size: { width: 100, height: 60 } });
      store.setNodes([n1, n2Shifted]);
      component.edgeLinkDragState = {
        sourceNodeId: 'n1',
        sourcePortId: 'port-right',
        sourceX: 100,
        sourceY: 30,
        currentX: 0,
        currentY: 0,
      };

      const mouseUpEvent = new MouseEvent('mouseup', { clientX: 0, clientY: 0 });
      component.onDocMouseUp(mouseUpEvent);

      const edges = store.edges();
      expect(edges.length).toBe(1);
      expect(edges[0].sourceId).toBe('n1');
      expect(edges[0].targetId).toBe('n2');
      expect(edges[0].sourcePort).toBe('port-right');
      expect(edges[0].targetPort).toBe('port-left');
    });

    it('onDocMouseUp does not create an edge when drag ends over empty space', () => {
      const n1 = makeDiagramNode({ id: 'n1', position: { x: 500, y: 500 }, size: { width: 100, height: 60 } });
      store.setNodes([n1]);

      component.edgeLinkDragState = {
        sourceNodeId: 'n1',
        sourcePortId: 'port-right',
        sourceX: 600,
        sourceY: 530,
        currentX: 0,
        currentY: 0,
      };

      const mouseUpEvent = new MouseEvent('mouseup', { clientX: 0, clientY: 0 });
      component.onDocMouseUp(mouseUpEvent);

      expect(store.edges().length).toBe(0);
      expect(component.edgeLinkDragState).toBeNull();
    });

    it('onDocMouseUp does not create a self-connection', () => {
      // Port-left of n1 at origin: position (-50, -30), size (100, 60) → left port at (−50, 0) ≈ not (0,0)
      // Port-top of n1 near origin: position (-50, 0), size (100, 60) → top port at (0, 0) ✓
      const n1 = makeDiagramNode({ id: 'n1', position: { x: -50, y: 0 }, size: { width: 100, height: 60 } });
      store.setNodes([n1]);

      component.edgeLinkDragState = {
        sourceNodeId: 'n1',
        sourcePortId: 'port-bottom',
        sourceX: 0,
        sourceY: 60,
        currentX: 0,
        currentY: 0,
      };

      const mouseUpEvent = new MouseEvent('mouseup', { clientX: 0, clientY: 0 });
      component.onDocMouseUp(mouseUpEvent);

      expect(store.edges().length).toBe(0);
    });

    it('edge created from port drag uses activeColor and default arrowhead', () => {
      const n2 = makeDiagramNode({ id: 'n2', position: { x: 0, y: -30 }, size: { width: 100, height: 60 } });
      const n1 = makeDiagramNode({ id: 'n1', position: { x: 200, y: 200 }, size: { width: 100, height: 60 } });
      store.setNodes([n1, n2]);

      component.activeColor = '#ff0000';
      component.activeStrokeWidth = 3;
      component.activeStrokeStyle = 'dashed';

      component.edgeLinkDragState = {
        sourceNodeId: 'n1',
        sourcePortId: 'port-right',
        sourceX: 300,
        sourceY: 230,
        currentX: 0,
        currentY: 0,
      };

      component.onDocMouseUp(new MouseEvent('mouseup', { clientX: 0, clientY: 0 }));

      const edges = store.edges();
      expect(edges.length).toBe(1);
      expect(edges[0].style.strokeColor).toBe('#ff0000');
      expect(edges[0].style.strokeWidth).toBe(3);
      expect(edges[0].style.dashArray).toBe('8 4');
      expect(edges[0].style.markerEnd).toBe('arrow');
    });
  });

  describe('arrow draw port binding', () => {
    it('binds both arrow endpoints to nearby node ports during initial draw', () => {
      const node = makeDiagramNode({
        id: 'n1',
        position: { x: 100, y: 100 },
        size: { width: 100, height: 60 },
      });
      store.setNodes([node]);
      component.visibleNodes = [node];
      component.setTool('arrow');

      // Near left port (100,130)
      component.onDrawMouseDown(new MouseEvent('mousedown', { clientX: 103, clientY: 129 }));
      // Near right port (200,130)
      component.onDrawMouseUp(new MouseEvent('mouseup', { clientX: 198, clientY: 132 }));

      const anns = store.annotations();
      expect(anns.length).toBe(1);
      expect(anns[0].type).toBe('arrow');
      expect(anns[0].x).toBe(100);
      expect(anns[0].y).toBe(130);
      expect(anns[0].x2).toBe(200);
      expect(anns[0].y2).toBe(130);
      expect(anns[0].sourceBinding).toEqual({ nodeId: 'n1', portId: 'port-left' });
      expect(anns[0].targetBinding).toEqual({ nodeId: 'n1', portId: 'port-right' });
    });

    it('creates an unbound arrow when start/end are not near node ports', () => {
      const node = makeDiagramNode({
        id: 'n1',
        position: { x: 100, y: 100 },
        size: { width: 100, height: 60 },
      });
      store.setNodes([node]);
      component.visibleNodes = [node];
      component.setTool('arrow');

      component.onDrawMouseDown(new MouseEvent('mousedown', { clientX: 20, clientY: 20 }));
      component.onDrawMouseUp(new MouseEvent('mouseup', { clientX: 60, clientY: 60 }));

      const anns = store.annotations();
      expect(anns.length).toBe(1);
      expect(anns[0].type).toBe('arrow');
      expect(anns[0].x).toBe(20);
      expect(anns[0].y).toBe(20);
      expect(anns[0].x2).toBe(60);
      expect(anns[0].y2).toBe(60);
      expect(anns[0].sourceBinding).toBeUndefined();
      expect(anns[0].targetBinding).toBeUndefined();
    });
  });

  describe('arrow endpoint drag rebinding', () => {
    it('binds an endpoint to a port when mouse-up lands on a port', () => {
      // Node at (0, -30), size (100, 60) → port-left at (0, 0)
      const node = makeDiagramNode({ id: 'n1', position: { x: 0, y: -30 }, size: { width: 100, height: 60 } });
      store.setNodes([node]);
      component.visibleNodes = [node];

      const ann = makeAnnotation({ id: 'ann-1', type: 'arrow', x: 50, y: 50, x2: 200, y2: 200 });
      store.setAnnotations([ann]);

      // Start dragging the 'end' endpoint
      const mouseDownEvt = {
        stopPropagation: jasmine.createSpy(),
        preventDefault: jasmine.createSpy(),
        clientX: 200,
        clientY: 200,
        button: 0,
      } as unknown as MouseEvent;
      component.onAnnEndpointMouseDown(mouseDownEvt, ann, 'end');

      // Mouse-up over port-left of node (canvas coords 0,0 since no host element)
      component.onDocMouseUp(new MouseEvent('mouseup', { clientX: 0, clientY: 0 }));

      const updated = store.annotations().find(a => a.id === 'ann-1');
      expect(updated?.targetBinding?.nodeId).toBe('n1');
      expect(updated?.targetBinding?.portId).toBe('port-left');
    });

    it('unbinds an endpoint when dragged to empty space', () => {
      // Node far from origin so its ports are not at (0,0)
      const node = makeDiagramNode({ id: 'n1', position: { x: 500, y: 500 }, size: { width: 100, height: 60 } });
      store.setNodes([node]);
      component.visibleNodes = [node];

      const ann = makeAnnotation({
        id: 'ann-1',
        type: 'arrow',
        x: 50,
        y: 50,
        x2: 200,
        y2: 200,
        sourceBinding: { nodeId: 'n1', portId: 'port-left' },
      });
      store.setAnnotations([ann]);

      // Drag the 'start' endpoint (mousemove clears the binding)
      const mouseDownEvt = {
        stopPropagation: jasmine.createSpy(),
        preventDefault: jasmine.createSpy(),
        clientX: 50,
        clientY: 50,
        button: 0,
      } as unknown as MouseEvent;
      component.onAnnEndpointMouseDown(mouseDownEvt, ann, 'start');

      // Simulate a mousemove which clears sourceBinding and updates raw coords
      component.onDocMouseMove(new MouseEvent('mousemove', { clientX: 80, clientY: 80 }));

      const afterMove = store.annotations().find(a => a.id === 'ann-1');
      expect(afterMove?.sourceBinding).toBeUndefined();

      // Mouse-up over empty space (no port within snap range of (0,0))
      component.onDocMouseUp(new MouseEvent('mouseup', { clientX: 80, clientY: 80 }));

      const afterUp = store.annotations().find(a => a.id === 'ann-1');
      expect(afterUp?.sourceBinding).toBeUndefined();
    });
  });

  describe('bound arrow duplication', () => {
    it('clears sourceBinding and targetBinding when duplicating a bound arrow', () => {
      const ann = makeAnnotation({
        id: 'ann-bound',
        type: 'arrow',
        x: 100,
        y: 100,
        x2: 200,
        y2: 200,
        sourceBinding: { nodeId: 'n1', portId: 'port-left' },
        targetBinding: { nodeId: 'n2', portId: 'port-right' },
      });
      store.setAnnotations([ann]);
      component.selectedAnnotationId = 'ann-bound';
      component.selectedAnnotationIds = ['ann-bound'];

      component.duplicateSelectedAnnotation();

      const all = store.annotations();
      expect(all.length).toBe(2);
      const dup = all.find(a => a.id !== 'ann-bound');
      expect(dup).toBeDefined();
      expect(dup?.sourceBinding).toBeUndefined();
      expect(dup?.targetBinding).toBeUndefined();
      expect(dup?.x).toBe(120);
      expect(dup?.y).toBe(120);
    });
  });

  describe('unified highlight rules', () => {
    it('applies internal-item styling rules across matching internal text items', () => {
      const nodeA = makeDiagramNode({
        id: 'n-a',
        custom: {
          internalItems: [
            { id: 'a1', text: 'port 443', x: 1, y: 1, color: '#000000', backgroundColor: '#ffffff' },
            { id: 'a2', text: 'owner', x: 1, y: 20, color: '#000000', backgroundColor: '#ffffff' },
          ],
        },
      });
      const nodeB = makeDiagramNode({
        id: 'n-b',
        custom: {
          internalItems: [
            { id: 'b1', text: 'port 80', x: 1, y: 1, color: '#222222', backgroundColor: '#f0f0f0' },
          ],
        },
      });
      store.setNodes([nodeA, nodeB]);

      component.onTagRulesChange([
        {
          id: 'ir-1',
          type: 'internal-item',
          textQuery: 'port',
          textColor: '#111111',
          backgroundColor: '#eeeeee',
        },
      ]);

      const updatedA = store.nodes().find(n => n.id === 'n-a')!;
      const updatedB = store.nodes().find(n => n.id === 'n-b')!;
      const aItems = updatedA.custom?.internalItems ?? [];
      const bItems = updatedB.custom?.internalItems ?? [];
      const aPort = aItems.find(i => i.id === 'a1');
      const aOwner = aItems.find(i => i.id === 'a2');
      const bPort = bItems.find(i => i.id === 'b1');

      expect(aPort).toBeDefined();
      expect(aOwner).toBeDefined();
      expect(bPort).toBeDefined();
      expect(aPort?.color).toBe('#111111');
      expect(aPort?.backgroundColor).toBe('#eeeeee');
      expect(bPort?.color).toBe('#111111');
      expect(bPort?.backgroundColor).toBe('#eeeeee');
      expect(aOwner?.color).toBe('#000000');
      expect(aOwner?.backgroundColor).toBe('#ffffff');
    });

    it('applies internal-item rules in order (later rules override earlier matches)', () => {
      const node = makeDiagramNode({
        id: 'n-order',
        custom: {
          internalItems: [
            { id: 'i1', text: 'port 443', x: 1, y: 1, color: '#000000', backgroundColor: '#ffffff' },
          ],
        },
      });
      store.setNodes([node]);

      component.onTagRulesChange([
        {
          id: 'ir-1',
          type: 'internal-item',
          textQuery: 'port',
          textColor: '#111111',
          backgroundColor: '#eeeeee',
        },
        {
          id: 'ir-2',
          type: 'internal-item',
          textQuery: '443',
          textColor: '#222222',
          backgroundColor: '#dddddd',
        },
      ]);

      const updated = store.nodes().find(n => n.id === 'n-order')!;
      const item = (updated.custom?.internalItems ?? []).find(i => i.id === 'i1');
      expect(item).toBeDefined();
      expect(item?.color).toBe('#222222');
      expect(item?.backgroundColor).toBe('#dddddd');
    });

    it('reverts internal-item colors to base when a rule is removed', () => {
      const node = makeDiagramNode({
        id: 'n-revert',
        custom: {
          internalItems: [
            { id: 'i1', text: 'port 443', x: 1, y: 1, color: '#000000', backgroundColor: '#ffffff' },
          ],
        },
      });
      store.setNodes([node]);

      // Apply a rule — colors should be overridden.
      component.onTagRulesChange([
        { id: 'ir-1', type: 'internal-item', textQuery: 'port', textColor: '#111111', backgroundColor: '#eeeeee' },
      ]);
      const afterApply = store.nodes().find(n => n.id === 'n-revert')!;
      const appliedItem = afterApply.custom?.internalItems?.[0];
      expect(appliedItem?.color).toBe('#111111');
      // baseColor must be preserved so the original can be restored on rule removal.
      expect(appliedItem?.baseColor).toBe('#000000');

      // Remove the rule — colors should revert to the original values.
      component.onTagRulesChange([]);
      const afterRevert = store.nodes().find(n => n.id === 'n-revert')!;
      const reverted = afterRevert.custom?.internalItems?.[0];
      expect(reverted?.color).toBe('#000000');
      expect(reverted?.backgroundColor).toBe('#ffffff');
    });

    it('reverts colors only for items that no longer match when a rule query changes', () => {
      const node = makeDiagramNode({
        id: 'n-query-change',
        custom: {
          internalItems: [
            { id: 'i1', text: 'port 443', x: 1, y: 1, color: '#aaaaaa', backgroundColor: '#bbbbbb' },
            { id: 'i2', text: 'owner tag', x: 1, y: 20, color: '#cccccc', backgroundColor: '#dddddd' },
          ],
        },
      });
      store.setNodes([node]);

      // Apply a broad rule that matches both items.
      component.onTagRulesChange([
        { id: 'ir-1', type: 'internal-item', textQuery: '', textColor: '#111111', backgroundColor: '#eeeeee' },
      ]);
      const bothStyled = store.nodes().find(n => n.id === 'n-query-change')!.custom?.internalItems ?? [];
      expect(bothStyled.find(i => i.id === 'i1')?.color).toBe('#111111');
      expect(bothStyled.find(i => i.id === 'i2')?.color).toBe('#111111');

      // Narrow the rule so only 'port' items still match.
      component.onTagRulesChange([
        { id: 'ir-1', type: 'internal-item', textQuery: 'port', textColor: '#111111', backgroundColor: '#eeeeee' },
      ]);
      const afterNarrow = store.nodes().find(n => n.id === 'n-query-change')!.custom?.internalItems ?? [];
      expect(afterNarrow.find(i => i.id === 'i1')?.color).toBe('#111111');   // still matches
      expect(afterNarrow.find(i => i.id === 'i2')?.color).toBe('#cccccc');   // reverted to original
      expect(afterNarrow.find(i => i.id === 'i2')?.backgroundColor).toBe('#dddddd');
    });

    it('applies existing internal-item rules to a node created via onCreateResourceConfirm', () => {
      // Establish a rule before any node is created.
      store.tagRules.set([
        { id: 'ir-1', type: 'internal-item', textQuery: 'port', textColor: '#ff0000', backgroundColor: '#ffeeee' },
      ]);

      component.resourcePlacementPosition = { x: 10, y: 10 };
      component.activeResourceType = 'microsoft.network/virtualnetworks';

      component.onCreateResourceConfirm({
        name: 'new-resource',
        resourceGroup: 'rg-1',
        status: 'running',
        description: '',
        location: 'eastus',
        tags: [],
        internalItems: [{ text: 'port 443' }, { text: 'owner' }],
      });

      const created = store.nodes().find(n => n.label === 'new-resource');
      expect(created).toBeDefined();
      const items = created?.custom?.internalItems ?? [];
      const portItem = items.find(i => i.text === 'port 443');
      const ownerItem = items.find(i => i.text === 'owner');
      // Rule should already be applied to the matching item.
      expect(portItem?.color).toBe('#ff0000');
      expect(portItem?.backgroundColor).toBe('#ffeeee');
      // Non-matching item keeps its default colors.
      expect(ownerItem?.color).toBe('#1d4ed8');
      expect(ownerItem?.backgroundColor).toBe('#eff6ff');
    });
  });

  // ── Annotation click / context-menu priority over nodes ─────────────────────
  //
  // canvasPointFromClient() returns {x:0, y:0} in tests because there is no
  // real host element.  A node placed at position (0,0) with any positive size
  // therefore counts as "under" any click.

  describe('onAnnotationMouseDown – click priority over overlapping nodes', () => {
    let node: ReturnType<typeof makeDiagramNode>;
    let mouseEvent: MouseEvent;

    beforeEach(() => {
      node = makeDiagramNode({ id: 'node-under', position: { x: 0, y: 0 }, size: { width: 200, height: 200 } });
      store.setNodes([node]);
      component.visibleNodes = [node];
      mouseEvent = { button: 0, clientX: 0, clientY: 0, preventDefault: jasmine.createSpy(), stopPropagation: jasmine.createSpy() } as unknown as MouseEvent;
    });

    it('image annotation over a node selects the annotation, not the node', () => {
      const ann = makeAnnotation({ id: 'img-1', type: 'image', x: 0, y: 0, width: 100, height: 100 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBe('img-1');
      expect(store.selectedNodeIds().length).toBe(0);
    });

    it('text annotation over a node selects the annotation, not the node', () => {
      const ann = makeAnnotation({ id: 'txt-1', type: 'text', x: 0, y: 0 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBe('txt-1');
      expect(store.selectedNodeIds().length).toBe(0);
    });

    it('sticky annotation over a node selects the annotation, not the node', () => {
      const ann = makeAnnotation({ id: 'sticky-1', type: 'sticky', x: 0, y: 0 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBe('sticky-1');
      expect(store.selectedNodeIds().length).toBe(0);
    });

    it('rect annotation over a node still defers to the node (shape overlays are node-first)', () => {
      const ann = makeAnnotation({ id: 'rect-1', type: 'rect', x: 0, y: 0, width: 50, height: 50 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBeNull();
      expect(store.selectedNodeIds()).toContain('node-under');
    });

    it('arrow annotation over a node defers to the node (stroke-based annotations are node-first)', () => {
      const ann = makeAnnotation({ id: 'arrow-1', type: 'arrow', x: 0, y: 0, x2: 50, y2: 50 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBeNull();
      expect(store.selectedNodeIds()).toContain('node-under');
    });

    it('line annotation over a node defers to the node (stroke-based annotations are node-first)', () => {
      const ann = makeAnnotation({ id: 'line-1', type: 'line', x: 0, y: 0, x2: 50, y2: 50 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBeNull();
      expect(store.selectedNodeIds()).toContain('node-under');
    });

    it('draw annotation over a node defers to the node (stroke-based annotations are node-first)', () => {
      const ann = makeAnnotation({ id: 'draw-1', type: 'draw', x: 0, y: 0, pathData: 'M 0 0 L 50 50' });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBeNull();
      expect(store.selectedNodeIds()).toContain('node-under');
    });

    it('image annotation with no node underneath selects the annotation', () => {
      component.visibleNodes = [];
      const ann = makeAnnotation({ id: 'img-2', type: 'image', x: 0, y: 0, width: 100, height: 100 });
      store.setAnnotations([ann]);

      component.onAnnotationMouseDown(mouseEvent, ann);

      expect(component.selectedAnnotationId).toBe('img-2');
    });

    it('double-clicking a non-opaque annotation over a node opens the resource editor', () => {
      const openEditorSpy = spyOn(component, 'openResourceEditor');
      const ann = makeAnnotation({ id: 'rect-2', type: 'rect', x: 0, y: 0, width: 50, height: 50 });
      store.setAnnotations([ann]);

      const dblClickEvent = {
        button: 0,
        detail: 2,
        clientX: 0,
        clientY: 0,
        preventDefault: jasmine.createSpy('preventDefault'),
        stopPropagation: jasmine.createSpy('stopPropagation'),
      } as unknown as MouseEvent;

      component.onAnnotationMouseDown(dblClickEvent, ann);

      expect(openEditorSpy).toHaveBeenCalledWith('node-under');
      expect(component.selectedAnnotationId).toBeNull();
    });
  });

  describe('onAnnotationContextMenu – opaque annotations show annotation context menu', () => {
    let node: ReturnType<typeof makeDiagramNode>;
    let ctxEvent: MouseEvent;
    let onContextMenuRequestedSpy: jasmine.Spy;

    beforeEach(() => {
      node = makeDiagramNode({ id: 'node-under', position: { x: 0, y: 0 }, size: { width: 200, height: 200 } });
      store.setNodes([node]);
      component.visibleNodes = [node];
      ctxEvent = { clientX: 0, clientY: 0, preventDefault: jasmine.createSpy(), stopPropagation: jasmine.createSpy() } as unknown as MouseEvent;
      // Extend the shared mock with properties used inside onAnnotationContextMenu.
      (ctxMenuSvcMock as Record<string, unknown>)['rgContextMenu'] = null;
      (ctxMenuSvcMock as Record<string, unknown>)['multiSelectContextMenu'] = null;
      onContextMenuRequestedSpy = jasmine.createSpy('onContextMenuRequested');
      (ctxMenuSvcMock as Record<string, unknown>)['onContextMenuRequested'] = onContextMenuRequestedSpy;
    });

    it('right-clicking an image over a node shows the annotation context menu', () => {
      const ann = makeAnnotation({ id: 'img-1', type: 'image', x: 0, y: 0, width: 100, height: 100 });
      store.setAnnotations([ann]);

      component.onAnnotationContextMenu(ctxEvent, ann);

      expect(ctxMenuSvcMock.annotationContextMenu?.annotationId).toBe('img-1');
      expect(onContextMenuRequestedSpy).not.toHaveBeenCalled();
    });

    it('right-clicking a text annotation over a node shows the annotation context menu', () => {
      const ann = makeAnnotation({ id: 'txt-1', type: 'text', x: 0, y: 0 });
      store.setAnnotations([ann]);

      component.onAnnotationContextMenu(ctxEvent, ann);

      expect(ctxMenuSvcMock.annotationContextMenu?.annotationId).toBe('txt-1');
      expect(onContextMenuRequestedSpy).not.toHaveBeenCalled();
    });

    it('right-clicking a sticky annotation over a node shows the annotation context menu', () => {
      const ann = makeAnnotation({ id: 'sticky-1', type: 'sticky', x: 0, y: 0 });
      store.setAnnotations([ann]);

      component.onAnnotationContextMenu(ctxEvent, ann);

      expect(ctxMenuSvcMock.annotationContextMenu?.annotationId).toBe('sticky-1');
      expect(onContextMenuRequestedSpy).not.toHaveBeenCalled();
    });

    it('right-clicking a rect annotation over a node shows the node context menu', () => {
      const ann = makeAnnotation({ id: 'rect-1', type: 'rect', x: 0, y: 0, width: 50, height: 50 });
      store.setAnnotations([ann]);

      component.onAnnotationContextMenu(ctxEvent, ann);

      expect(ctxMenuSvcMock.annotationContextMenu).toBeNull();
      expect(onContextMenuRequestedSpy).toHaveBeenCalledWith(
        jasmine.objectContaining({ nodeId: 'node-under' })
      );
    });

    it('right-clicking an image with no node underneath shows the annotation context menu', () => {
      component.visibleNodes = [];
      const ann = makeAnnotation({ id: 'img-2', type: 'image', x: 0, y: 0, width: 100, height: 100 });
      store.setAnnotations([ann]);

      component.onAnnotationContextMenu(ctxEvent, ann);

      expect(ctxMenuSvcMock.annotationContextMenu?.annotationId).toBe('img-2');
      expect(onContextMenuRequestedSpy).not.toHaveBeenCalled();
    });
  });

  describe('onCanvasBackgroundContextMenu', () => {
    it('does nothing when active tool is not pointer', () => {
      component.activeTool = 'rect';
      component.onCanvasBackgroundContextMenu({ clientX: 10, clientY: 10 } as MouseEvent);
      expect(ctxMenuSvcMock.onRgContextMenu).not.toHaveBeenCalled();
      expect(ctxMenuSvcMock.onSubscriptionContextMenu).not.toHaveBeenCalled();
    });

    it('does nothing when pointer is over a node', () => {
      const node = makeDiagramNode({ id: 'node-over', position: { x: 0, y: 0 }, size: { width: 200, height: 200 } });
      component.visibleNodes = [node];
      component.subscriptionBounds = [{ id: 'sub1', subscriptionId: 'sub1', name: 'Sub 1', collapsed: false, x: 0, y: 0, width: 400, height: 300 }];
      component.rgBounds = [{ id: 'sub1::rg1', subscriptionId: 'sub1', name: 'rg1', collapsed: false, x: 0, y: 0, width: 300, height: 200 }];

      component.onCanvasBackgroundContextMenu({ clientX: 20, clientY: 20 } as MouseEvent);

      expect(ctxMenuSvcMock.onRgContextMenu).not.toHaveBeenCalled();
      expect(ctxMenuSvcMock.onSubscriptionContextMenu).not.toHaveBeenCalled();
    });

    it('prefers RG context menu when both RG and subscription bounds match', () => {
      component.visibleNodes = [];
      component.subscriptionBounds = [{ id: 'sub1', subscriptionId: 'sub1', name: 'Sub 1', collapsed: false, x: 0, y: 0, width: 400, height: 300 }];
      component.rgBounds = [{ id: 'sub1::rg1', subscriptionId: 'sub1', name: 'rg1', collapsed: false, x: 0, y: 0, width: 300, height: 200 }];

      component.onCanvasBackgroundContextMenu({ clientX: 40, clientY: 40 } as MouseEvent);

      expect(ctxMenuSvcMock.onRgContextMenu).toHaveBeenCalled();
      expect(ctxMenuSvcMock.onSubscriptionContextMenu).not.toHaveBeenCalled();
    });

    it('opens subscription context menu when no RG bound matches', () => {
      component.visibleNodes = [];
      component.subscriptionBounds = [{ id: 'sub1', subscriptionId: 'sub1', name: 'Sub 1', collapsed: false, x: 0, y: 0, width: 400, height: 300 }];
      component.rgBounds = [{ id: 'sub1::rg1', subscriptionId: 'sub1', name: 'rg1', collapsed: false, x: 500, y: 500, width: 300, height: 200 }];

      component.onCanvasBackgroundContextMenu({ clientX: 40, clientY: 40 } as MouseEvent);

      expect(ctxMenuSvcMock.onRgContextMenu).not.toHaveBeenCalled();
      expect(ctxMenuSvcMock.onSubscriptionContextMenu).toHaveBeenCalled();
    });
  });

  it('ctxSubscriptionAutoLayout delegates to context menu service', async () => {
    await component.ctxSubscriptionAutoLayout();
    expect(ctxMenuSvcMock.ctxSubscriptionAutoLayout).toHaveBeenCalled();
  });

  describe('hand tool panning', () => {
    it('starts canvas pan on background mousedown when hand tool is active', () => {
      component.activeTool = 'hand';

      component.onCanvasBackgroundMouseDown({ button: 0, clientX: 120, clientY: 80 } as MouseEvent);

      expect(component.canvasPanState).toEqual({ lastX: 120, lastY: 80 });
    });

    it('pans canvas scroll on document mouse move while hand pan is active', () => {
      const host = document.createElement('div');
      Object.defineProperty(host, 'scrollLeft', { value: 200, writable: true });
      Object.defineProperty(host, 'scrollTop', { value: 100, writable: true });
      component.canvasHostRef = { nativeElement: host } as unknown as typeof component.canvasHostRef;
      component.canvasPanState = { lastX: 100, lastY: 100 };

      component.onDocMouseMove(new MouseEvent('mousemove', { clientX: 130, clientY: 90 }));

      expect(host.scrollLeft).toBe(170);
      expect(host.scrollTop).toBe(110);
      expect(component.canvasPanState).toEqual({ lastX: 130, lastY: 90 });
    });

    it('clears hand pan state on document mouse up', () => {
      component.activeTool = 'hand';
      component.canvasPanState = { lastX: 50, lastY: 50 };

      component.onDocMouseUp(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));

      expect(component.canvasPanState).toBeNull();
    });
  });

  describe('eraser tool', () => {
    beforeEach(() => {
      setCanvasHost();
      component.setTool('eraser');
    });

    it('erases a node and its connected edges after the fade delay', () => {
      jasmine.clock().install();
      try {
        const node1 = makeDiagramNode({ id: 'n1', position: { x: 40, y: 40 }, size: { width: 120, height: 80 } });
        const node2 = makeDiagramNode({ id: 'n2', position: { x: 260, y: 40 }, size: { width: 120, height: 80 } });
        const edge = makeDiagramEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });
        store.setNodes([node1, node2]);
        store.setEdges([edge]);
        component.visibleNodes = [node1, node2];
        component.visibleEdges = [edge];
        const pushUndoSpy = spyOn(store, 'pushUndo').and.callThrough();

        component.onCanvasBackgroundMouseDown(new MouseEvent('mousedown', { clientX: 80, clientY: 70, button: 0 }));

        expect(component.erasingTargetKeys.has('node:n1')).toBeTrue();
        jasmine.clock().tick(181);

        expect(pushUndoSpy).toHaveBeenCalledTimes(1);
        expect(store.nodes().map(node => node.id)).toEqual(['n2']);
        expect(store.edges().length).toBe(0);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('batches multiple erased nodes into a single undo step for one stroke', () => {
      jasmine.clock().install();
      try {
        const node1 = makeDiagramNode({ id: 'n1', position: { x: 40, y: 40 }, size: { width: 80, height: 80 } });
        const node2 = makeDiagramNode({ id: 'n2', position: { x: 220, y: 40 }, size: { width: 80, height: 80 } });
        store.setNodes([node1, node2]);
        component.visibleNodes = [node1, node2];
        const pushUndoSpy = spyOn(store, 'pushUndo').and.callThrough();

        component.onCanvasBackgroundMouseDown(new MouseEvent('mousedown', { clientX: 70, clientY: 70, button: 0 }));
        component.onDocMouseMove(new MouseEvent('mousemove', { clientX: 250, clientY: 70 }));
        component.onDocMouseUp(new MouseEvent('mouseup', { clientX: 250, clientY: 70 }));
        jasmine.clock().tick(181);

        expect(pushUndoSpy).toHaveBeenCalledTimes(1);
        expect(store.nodes().length).toBe(0);

        store.undo();

        expect(store.nodes().map(node => node.id)).toEqual(['n1', 'n2']);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('erases an edge without deleting its endpoint nodes', () => {
      jasmine.clock().install();
      try {
        const node1 = makeDiagramNode({ id: 'n1', position: { x: 40, y: 40 }, size: { width: 80, height: 80 } });
        const node2 = makeDiagramNode({ id: 'n2', position: { x: 260, y: 40 }, size: { width: 80, height: 80 } });
        const edge = makeDiagramEdge({
          id: 'e1',
          sourceId: 'n1',
          targetId: 'n2',
          waypoints: [{ x: 180, y: 80 }],
        });
        store.setNodes([node1, node2]);
        store.setEdges([edge]);
        component.visibleNodes = [node1, node2];
        component.visibleEdges = [edge];

        component.onCanvasBackgroundMouseDown(new MouseEvent('mousedown', { clientX: 180, clientY: 80, button: 0 }));
        jasmine.clock().tick(181);

        expect(store.nodes().map(node => node.id)).toEqual(['n1', 'n2']);
        expect(store.edges().length).toBe(0);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('erases an annotation and clears its selection', () => {
      jasmine.clock().install();
      try {
        const annotation = makeAnnotation({ id: 'ann-1', type: 'text', x: 100, y: 120, text: 'Erase me', fontSize: 16 });
        store.setAnnotations([annotation]);
        component.selectedAnnotationId = 'ann-1';
        component.selectedAnnotationIds = ['ann-1'];

        component.onCanvasBackgroundMouseDown(new MouseEvent('mousedown', { clientX: 110, clientY: 130, button: 0 }));
        jasmine.clock().tick(181);

        expect(store.annotations().length).toBe(0);
        expect(component.selectedAnnotationId).toBeNull();
        expect(component.selectedAnnotationIds).toEqual([]);
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });

  describe('panel state persistence', () => {
    it('persists storage panel expanded state on node custom.panelState for export/import', () => {
      const node = makeDiagramNode({ id: 'sa-1' });
      store.setNodes([node]);
      (
        component as unknown as {
          nodeExpansion: { apply: (nodes: DiagramNode[]) => DiagramNode[] };
        }
      ).nodeExpansion = { apply: (nodes: DiagramNode[]) => nodes };

      component.onStorageAccountExpansionChanged({ nodeId: 'sa-1', expanded: true, itemCount: 3 });
      let updated = store.nodes().find(n => n.id === 'sa-1');
      expect(updated?.custom?.panelState?.['storageAccount']).toBeTrue();

      component.onStorageAccountExpansionChanged({ nodeId: 'sa-1', expanded: false, itemCount: 0 });
      updated = store.nodes().find(n => n.id === 'sa-1');
      expect(updated?.custom?.panelState?.['storageAccount']).toBeFalse();
    });
  });

  describe('custom shape binding', () => {
    it('computes a bind action when an unbound node is inside a shape container', () => {
      const node = makeDiagramNode({
        id: 'n-shape',
        group: 'standalone',
        position: { x: 100, y: 100 },
        size: { width: 160, height: 80 },
      });
      const shape = makeAnnotation({
        id: 'shape-1',
        type: 'rect',
        x: 90,
        y: 90,
        width: 260,
        height: 200,
      });
      store.setNodes([node]);
      store.setAnnotations([shape]);
      component.visibleNodes = [node];

      (component as unknown as { recomputeNodeContainerActions: () => void }).recomputeNodeContainerActions();
      const action = component.nodeContainerActions.get('n-shape');
      expect(action?.kind).toBe('bind');
      expect(action?.targetType).toBe('shape');
      expect(action?.targetId).toBe('shape-1');
    });

    it('uses drawn container name in bind label', () => {
      const node = makeDiagramNode({
        id: 'n-drawn',
        group: 'standalone',
        position: { x: 100, y: 100 },
        size: { width: 100, height: 60 },
      });
      const drawn = makeAnnotation({
        id: 'drawn-rg-1',
        type: 'rect',
        x: 80,
        y: 80,
        width: 260,
        height: 180,
        container: { kind: 'rg', name: 'App RG', collapsed: false },
      });
      store.setNodes([node]);
      store.setAnnotations([drawn]);
      component.visibleNodes = [node];

      (component as unknown as { recomputeNodeContainerActions: () => void }).recomputeNodeContainerActions();
      const action = component.nodeContainerActions.get('n-drawn');
      expect(action?.kind).toBe('bind');
      expect(action?.label).toBe('Bind to App RG');
      expect(action?.targetType).toBe('shape');
    });

    it('binds a node to shape and then breaks out via unified action', () => {
      const node = makeDiagramNode({ id: 'n-shape', group: 'standalone' });
      store.setNodes([node]);

      component.nodeContainerActions.set('n-shape', {
        kind: 'bind',
        label: 'Bind to rectangle',
        title: 'Bind to rectangle',
        targetType: 'shape',
        targetId: 'shape-1',
      });
      component.onNodeContainerAction('n-shape');
      let updated = store.nodes().find(n => n.id === 'n-shape');
      expect(updated?.custom?.boundShapeAnnotationId).toBe('shape-1');

      component.nodeContainerActions.set('n-shape', {
        kind: 'breakout',
        label: 'Break out of rectangle',
        title: 'Break out of rectangle',
        targetType: 'shape',
        targetId: 'shape-1',
      });
      component.onNodeContainerAction('n-shape');
      updated = store.nodes().find(n => n.id === 'n-shape');
      expect(updated?.custom?.boundShapeAnnotationId).toBeUndefined();
    });

    it('moves bound nodes when their bound shape is dragged', () => {
      interface DragSvcTestContext {
        updateAnnotation: (id: string, changes: { x: number; y: number }) => void;
        toolbarPos: { x: number; y: number };
        toolbarDragState: unknown;
        nodeDragState: unknown;
        subscriptionDragState: unknown;
        vmDragState: unknown;
        rgDragState: unknown;
        k8sNamespaceDragState: unknown;
        k8sScopeDragState: unknown;
        k8sClusterDragState: unknown;
      }
      const node = makeDiagramNode({
        id: 'n-shape',
        group: 'standalone',
        position: { x: 100, y: 120 },
        custom: { boundShapeAnnotationId: 'shape-1' },
      });
      const shape = makeAnnotation({
        id: 'shape-1',
        type: 'rect',
        x: 10,
        y: 20,
        width: 200,
        height: 140,
      });
      store.setNodes([node]);
      store.setAnnotations([shape]);

      (
        component as unknown as {
          dragSvc: { onDocumentMouseMove: (ctx: DragSvcTestContext) => unknown };
        }
      ).dragSvc = {
        onDocumentMouseMove: (ctx: DragSvcTestContext) => {
          ctx.updateAnnotation('shape-1', { x: 30, y: 50 });
          return {
            handled: true,
            toolbarPos: ctx.toolbarPos,
            toolbarDragState: ctx.toolbarDragState,
            nodeDragState: ctx.nodeDragState,
            subscriptionDragState: ctx.subscriptionDragState,
            vmDragState: ctx.vmDragState,
            rgDragState: ctx.rgDragState,
            k8sNamespaceDragState: ctx.k8sNamespaceDragState,
            k8sScopeDragState: ctx.k8sScopeDragState,
            k8sClusterDragState: ctx.k8sClusterDragState,
          };
        },
      };

      (component as unknown as { annDragId: string | null }).annDragId = 'shape-1';
      component.onDocMouseMove(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));

      const moved = store.nodes().find(n => n.id === 'n-shape');
      expect(moved?.position).toEqual({ x: 120, y: 150 });
    });

    it('expands bound shape when resizing a node inside it', () => {
      const node = makeDiagramNode({
        id: 'n-shape',
        group: 'standalone',
        position: { x: 100, y: 100 },
        size: { width: 160, height: 80 },
        custom: { boundShapeAnnotationId: 'shape-1' },
      });
      const shape = makeAnnotation({
        id: 'shape-1',
        type: 'rect',
        x: 110,
        y: 110,
        width: 120,
        height: 100,
      });
      store.setNodes([node]);
      store.setAnnotations([shape]);

      component.onNodeResized({ nodeId: 'n-shape', width: 220, height: 120 });

      const resizedShape = store.annotations().find(a => a.id === 'shape-1');
      expect(resizedShape?.x).toBe(80);
      expect(resizedShape?.y).toBe(80);
      expect(resizedShape?.width).toBe(260);
      expect(resizedShape?.height).toBe(160);
    });

    it('clears node shape bindings when deleting selected shape annotations', () => {
      const node = makeDiagramNode({
        id: 'n-shape',
        group: 'standalone',
        custom: { boundShapeAnnotationId: 'shape-1' },
      });
      const shape = makeAnnotation({ id: 'shape-1', type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      store.setNodes([node]);
      store.setAnnotations([shape]);
      component.selectedAnnotationId = 'shape-1';
      component.selectedAnnotationIds = ['shape-1'];

      component.deleteSelectedAnnotation();

      const updated = store.nodes().find(n => n.id === 'n-shape');
      expect(updated?.custom?.boundShapeAnnotationId).toBeUndefined();
      expect(store.annotations().find(a => a.id === 'shape-1')).toBeUndefined();
    });
  });
});
