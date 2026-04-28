import { CostService } from './cost.service';
import { DiagramNode } from '../models/diagram-node.model';
import { FinOpsV2Response, FinOpsDiagnostics } from '../models/cost-data.model';
import { AzureResource } from '../models/azure-resource.model';
import { HttpClient } from '@angular/common/http';

const RID = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1';

function mkNode(id: string): DiagramNode {
  return {
    id,
    label: id.split('/').pop() ?? 'node',
    resourceType: 'microsoft.compute/virtualmachines',
    iconUrl: '',
    group: 'resourceGroup',
    groupId: 'rg1',
    position: { x: 0, y: 0 },
    size: { width: 140, height: 92 },
    status: 'unknown',
    metadata: {} as AzureResource,
    selected: false,
    highlighted: false,
  };
}

function mkV2Payload(preset: 'mtd' | 'last30', resourceIds: string[]): FinOpsV2Response {
  return {
    periodPreset: preset,
    baseCurrency: 'EUR',
    totalCostInBaseCurrency: 50,
    costedResourceCount: resourceIds.length,
    loadedSubscriptionCount: 1,
    failedSubscriptionCount: 0,
    subscriptions: [],
    topResources: [],
    byResourceGroup: [],
    byResourceType: [],
    trend: [],
    diagnostics: {} as FinOpsDiagnostics,
    warnings: [],
    conversion: { source: '', asOf: '', ratesToBase: {} },
    resources: resourceIds.map(resourceId => ({
      subscriptionId: 'sub1',
      resourceId,
      normalizedResourceId: resourceId.toLowerCase(),
      resourceGroup: 'rg1',
      resourceType: 'microsoft.compute/virtualmachines',
      originalCost: 50,
      originalCurrency: 'EUR',
      costInBaseCurrency: 50,
    })),
  };
}

describe('CostService', () => {
  let svc: CostService;
  beforeEach(() => { svc = new CostService(null as unknown as HttpClient); });

  describe('normalizeResourceId', () => {
    it('lowercases', () =>
      expect(svc.normalizeResourceId('/SUBS/ABC')).toBe('/subs/abc'));

    it('trims leading and trailing whitespace', () =>
      expect(svc.normalizeResourceId('  /subs/abc  ')).toBe('/subs/abc'));

    it('removes a single trailing slash', () =>
      expect(svc.normalizeResourceId('/subs/abc/')).toBe('/subs/abc'));

    it('removes multiple trailing slashes', () =>
      expect(svc.normalizeResourceId('/subs/abc///')).toBe('/subs/abc'));

    it('applies all normalisations together', () =>
      expect(svc.normalizeResourceId('  /SUBS/ABC///  ')).toBe('/subs/abc'));

    it('leaves an already-normalised id unchanged', () =>
      expect(svc.normalizeResourceId('/subs/abc')).toBe('/subs/abc'));
  });

  describe('getCostBorderStyle', () => {
    it('returns grey 1px for $0 (unmapped)', () =>
      expect(svc.getCostBorderStyle(0)).toEqual({ borderWidth: '1px', borderColor: '#605e5c' }));

    it('returns green for $0.01 (tier 1 boundary)', () =>
      expect(svc.getCostBorderStyle(0.01).borderColor).toBe('#107c10'));

    it('returns green for $9.99 (just below tier 2)', () =>
      expect(svc.getCostBorderStyle(9.99).borderColor).toBe('#107c10'));

    it('returns yellow 2px at $10 (tier 2 boundary)', () =>
      expect(svc.getCostBorderStyle(10)).toEqual({ borderWidth: '2px', borderColor: '#ffb900' }));

    it('returns orange 3px at $50 (tier 3 boundary)', () =>
      expect(svc.getCostBorderStyle(50)).toEqual({ borderWidth: '3px', borderColor: '#ca5010' }));

    it('returns red 4px at $200 (tier 4 boundary)', () =>
      expect(svc.getCostBorderStyle(200)).toEqual({ borderWidth: '4px', borderColor: '#d13438' }));

    it('returns red for large values', () =>
      expect(svc.getCostBorderStyle(10000).borderColor).toBe('#d13438'));
  });

  describe('getCostHeatmapGlow', () => {
    it('returns none when maxCost is 0', () =>
      expect(svc.getCostHeatmapGlow(50, 0)).toBe('none'));

    it('returns none when cost is 0', () =>
      expect(svc.getCostHeatmapGlow(0, 100)).toBe('none'));

    it('returns green glow for ratio < 0.1', () =>
      expect(svc.getCostHeatmapGlow(5, 100)).toBe('0 0 4px 1px rgba(16,124,16,0.4)'));

    it('returns yellow glow for ratio = 0.1', () =>
      expect(svc.getCostHeatmapGlow(10, 100)).toBe('0 0 8px 2px rgba(255,185,0,0.5)'));

    it('returns yellow glow for ratio 0.1–0.3', () =>
      expect(svc.getCostHeatmapGlow(20, 100)).toBe('0 0 8px 2px rgba(255,185,0,0.5)'));

    it('returns orange glow for ratio = 0.3', () =>
      expect(svc.getCostHeatmapGlow(30, 100)).toBe('0 0 12px 3px rgba(202,80,16,0.6)'));

    it('returns red glow for ratio = 0.7', () =>
      expect(svc.getCostHeatmapGlow(70, 100)).toBe('0 0 16px 4px rgba(209,52,56,0.8)'));

    it('caps ratio at 1 when cost exceeds maxCost', () =>
      expect(svc.getCostHeatmapGlow(200, 100)).toBe('0 0 16px 4px rgba(209,52,56,0.8)'));
  });

  describe('enrichNodesWithCosts', () => {
    const costs = {
      totalUsd: 25,
      currency: 'USD',
      byResourceGroup: {},
      byResourceType: {},
      resources: [{ resourceId: RID, costUsd: 25, currency: 'USD', billingPeriod: '2024-01' }],
    };

    it('enriches a matched node', () => {
      const [result] = svc.enrichNodesWithCosts([mkNode(RID)], costs);
      expect(result.costData?.monthlyCostUsd).toBe(25);
      expect(result.costData?.currency).toBe('USD');
      expect(result.costData?.mappingState).toBe('matched');
    });

    it('matches case-insensitively and ignores trailing slashes', () => {
      const messyId = RID.toUpperCase() + '/';
      const messyCosts = { ...costs, resources: [{ ...costs.resources[0], resourceId: messyId }] };
      const [result] = svc.enrichNodesWithCosts([mkNode(RID)], messyCosts);
      expect(result.costData?.monthlyCostUsd).toBe(25);
    });

    it('leaves unmatched nodes unchanged', () => {
      const emptyCosts = { ...costs, resources: [] };
      const [result] = svc.enrichNodesWithCosts([mkNode(RID)], emptyCosts);
      expect(result.costData).toBeUndefined();
    });

    it('does not mutate the input node', () => {
      const node = mkNode(RID);
      svc.enrichNodesWithCosts([node], costs);
      expect(node.costData).toBeUndefined();
    });
  });

  describe('enrichNodesWithFinOps', () => {
    it('sets period label to "Month to Date" for mtd preset', () => {
      const [result] = svc.enrichNodesWithFinOps([mkNode(RID)], mkV2Payload('mtd', [RID]));
      expect(result.costData?.period).toBe('Month to Date');
    });

    it('sets period label to "Last 30 Days" for last30 preset', () => {
      const [result] = svc.enrichNodesWithFinOps([mkNode(RID)], mkV2Payload('last30', [RID]));
      expect(result.costData?.period).toBe('Last 30 Days');
    });

    it('sets costInBaseCurrency and baseCurrency on match', () => {
      const [result] = svc.enrichNodesWithFinOps([mkNode(RID)], mkV2Payload('mtd', [RID]));
      expect(result.costData?.monthlyCostUsd).toBe(50);
      expect(result.costData?.currency).toBe('EUR');
    });

    it('clears costData for unmatched nodes', () => {
      const node: DiagramNode = { ...mkNode(RID), costData: { monthlyCostUsd: 99, currency: 'USD', period: 'stale', isEstimate: false } };
      const [result] = svc.enrichNodesWithFinOps([node], mkV2Payload('mtd', []));
      expect(result.costData).toBeUndefined();
    });
  });

  describe('toTopNodes', () => {
    it('uses the last path segment as the label', () => {
      const payload = mkV2Payload('mtd', []);
      payload.topResources = [{
        subscriptionId: 'sub1',
        resourceId: '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/my-vm',
        normalizedResourceId: '',
        resourceGroup: 'rg1',
        resourceType: 'microsoft.compute/virtualmachines',
        originalCost: 42,
        originalCurrency: 'EUR',
        costInBaseCurrency: 42,
      }];
      const [top] = svc.toTopNodes(payload);
      expect(top.label).toBe('my-vm');
      expect(top.cost).toBe(42);
    });
  });
});
