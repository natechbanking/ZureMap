import { signal, WritableSignal } from '@angular/core';
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
import { makeAnnotation, makeAzureResource, makeDiagramEdge, makeDiagramNode } from '../../testing/test-helpers';

describe('CanvasComponent', () => {
  let component: CanvasComponent;
  let store: DiagramStore;
  let autosaveMock: { enabled: WritableSignal<boolean>; queueSave: jasmine.Spy };
  let ctxMenuSvcMock: {
    closeContextMenu: jasmine.Spy;
    annotationContextMenu: { x: number; y: number; annotationId: string } | null;
    contextMenu: { x: number; y: number; nodeId: string } | null;
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
        { provide: CanvasAnnotationService, useValue: { deleteButtonX: () => 0, deleteButtonY: () => 0 } },
        { provide: CanvasDragService, useValue: { onDocumentMouseMove: () => ({ handled: false }) } },
        { provide: CanvasOverlapService, useValue: { resolveSubscriptionContainerOverlaps: () => undefined } },
        { provide: CanvasNodeExpansionService, useValue: { apply: () => null } },
        { provide: CanvasTagVisualizationService, useValue: {} },
        { provide: CanvasContextMenuService, useValue: ctxMenuSvcMock },
        { provide: AutosaveService, useValue: autosaveMock },
      ],
    });

    component = TestBed.runInInjectionContext(() => new CanvasComponent());
    store = TestBed.inject(DiagramStore);
  });

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

    const pasteEvent = {
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent;
    component.onKeyDown(pasteEvent);

    const annotations = store.annotations();
    expect(copyEvent.preventDefault).toHaveBeenCalled();
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
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
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

    component.selectedAnnotationId = 'ann-2';
    component.selectedAnnotationIds = ['ann-2'];
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'c',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

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
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

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
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

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
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

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
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

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
    component.onKeyDown({
      ctrlKey: true,
      metaKey: false,
      key: 'v',
      target: document.createElement('div'),
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as KeyboardEvent);

    const pasted = store.nodes().find(n => n.id !== 'node-1');
    expect(pasted).toBeDefined();
    expect(pasted?.id).not.toBe('node-1');
    expect(pasted?.metadata.id).toBe(armId);
  });
});
