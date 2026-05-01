import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CanvasActionsService } from './canvas-actions.service';
import { DiagramStore } from '../../core/store/diagram.store';
import { ExportService } from '../../core/services/export.service';
import { CanvasFinopsService } from './canvas-finops.service';
import { AutosaveService } from '../../core/services/autosave.service';
import { FinOpsV2Response } from '../../core/models/cost-data.model';
import { makeAnnotation, makeDiagramEdge, makeDiagramNode, makeSubscription } from '../../testing/test-helpers';

describe('CanvasActionsService', () => {
  let service: CanvasActionsService;
  let store: DiagramStore;
  let autosaveMock: { disable: jasmine.Spy };
  let routerMock: { navigate: jasmine.Spy };
  let finopsMock: { loadFinOps: jasmine.Spy };

  beforeEach(() => {
    autosaveMock = {
      disable: jasmine.createSpy('disable').and.resolveTo(undefined),
    };
    routerMock = {
      navigate: jasmine.createSpy('navigate'),
    };
    finopsMock = {
      loadFinOps: jasmine.createSpy('loadFinOps'),
    };

    TestBed.configureTestingModule({
      providers: [
        CanvasActionsService,
        DiagramStore,
        { provide: ExportService, useValue: {} },
        { provide: CanvasFinopsService, useValue: finopsMock },
        { provide: AutosaveService, useValue: autosaveMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(CanvasActionsService);
    store = TestBed.inject(DiagramStore);
  });

  it('rescan clears all diagram content and navigates to scan', () => {
    const node = makeDiagramNode({ group: 'standalone', groupId: 'g1' });
    const edge = makeDiagramEdge({ targetId: 'n1' });
    const ann = makeAnnotation({ x: 0, y: 0, x2: 100, y2: 20 });

    store.setNodes([node]);
    store.setEdges([edge]);
    store.setAnnotations([ann]);

    service.rescan();

    expect(autosaveMock.disable).toHaveBeenCalledTimes(1);
    expect(store.nodes()).toEqual([]);
    expect(store.edges()).toEqual([]);
    expect(store.annotations()).toEqual([]);
    expect(routerMock.navigate).toHaveBeenCalledOnceWith(['/scan']);
  });

  it('onImportFile loads imported state and sets scanned session', async () => {
    const imported = {
      version: '1.0',
      exportedAt: '2026-04-30T00:00:00.000Z',
      subscriptions: [makeSubscription()],
      nodes: [makeDiagramNode({ id: 'n-import' })],
      edges: [makeDiagramEdge({ sourceId: 'n-import', targetId: 'n-import' })],
      annotations: [makeAnnotation({ id: 'a-import' })],
    };
    const exportSvc = TestBed.inject(ExportService) as unknown as { importFile: jasmine.Spy };
    exportSvc.importFile = jasmine.createSpy('importFile').and.resolveTo(imported);

    await service.onImportFile(new File(['{}'], 'map.json', { type: 'application/json' }));

    expect(store.activeSubscriptions()).toEqual(imported.subscriptions);
    expect(store.nodes()).toEqual(imported.nodes);
    expect(store.edges()).toEqual(imported.edges);
    expect(store.annotations()).toEqual(imported.annotations);
    expect(store.canvasSessionMode()).toBe('scanned');
  });

  it('refreshFinOps reports error when there are no active subscriptions', async () => {
    await service.refreshFinOps();

    expect(service.finOpsState()).toBe('error');
    expect(service.finOpsError()).toContain('No active subscriptions selected');
    expect(store.finOpsLayerActive()).toBeFalse();
  });

  it('refreshFinOps applies payload and marks partial when subscriptions fail', async () => {
    const node = makeDiagramNode({ id: 'n1' });
    const nextNode = { ...node, costData: { monthlyCostUsd: 20, currency: 'EUR', period: 'mtd', isEstimate: false } };
    const payload: FinOpsV2Response = {
      periodPreset: 'mtd',
      baseCurrency: 'EUR',
      totalCostInBaseCurrency: 20,
      costedResourceCount: 1,
      loadedSubscriptionCount: 1,
      failedSubscriptionCount: 1,
      subscriptions: [{ subscriptionId: 'sub1', status: 'failed', reason: '403' }],
      resources: [],
      topResources: [],
      byResourceGroup: [],
      byResourceType: [],
      trend: [],
      diagnostics: {
        requestedResourceCount: 1,
        matchedResourceCount: 1,
        unmatchedResourceCount: 0,
        sampleUnmatchedResourceIds: [],
        matchedCostRowCount: 1,
        unmatchedCostRowCount: 0,
        sampleUnmatchedCostResourceIds: [],
      },
      warnings: [],
      conversion: { source: 'ecb', asOf: '2026-04-30', ratesToBase: { EUR: 1 } },
    };

    store.activeSubscriptions.set([makeSubscription()]);
    store.setNodes([node]);
    finopsMock.loadFinOps.and.resolveTo({ nodes: [nextNode], payload });

    await service.refreshFinOps();

    expect(finopsMock.loadFinOps).toHaveBeenCalled();
    expect(service.finOpsPayload()).toEqual(payload);
    expect(service.finOpsState()).toBe('partial');
    expect(store.finOpsLayerActive()).toBeTrue();
    expect(store.nodes()[0].costData?.monthlyCostUsd).toBe(20);
  });
});
