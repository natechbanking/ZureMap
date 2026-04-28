import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { DiagramNode } from '../models/diagram-node.model';
import {
  CostQueryResponse,
  FinOpsRequestParams,
  FinOpsV2Response,
  SubscriptionCostSummary,
} from '../models/cost-data.model';

@Injectable({ providedIn: 'root' })
export class CostService {
  private http = inject(HttpClient);


  getSubscriptionCosts(subscriptionId: string): Observable<SubscriptionCostSummary | null> {
    return this.http.post<SubscriptionCostSummary>('/api/az/cost', { subscriptionId }).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 403) {
          console.warn('Cost Management Reader role required for FinOps data.');
        }
        return of(null);
      })
    );
  }

  getFinOpsV2(params: FinOpsRequestParams): Observable<FinOpsV2Response | null> {
    return this.http.post<FinOpsV2Response>('/api/az/cost/v2', {
      subscriptionIds: params.filters.subscriptionIds,
      periodPreset: params.periodPreset,
      filters: {
        resourceGroup: params.filters.resourceGroup,
        resourceType: params.filters.resourceType,
      },
      includeTrend: params.includeTrend,
      baseCurrency: params.baseCurrency,
      resourceIds: params.resourceIds,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 403) {
          console.warn('Cost Management Reader role required for FinOps data.');
        }
        return of(null);
      })
    );
  }

  enrichNodesWithCosts(
    nodes: DiagramNode[],
    costs: SubscriptionCostSummary
  ): DiagramNode[] {
    const byId = new Map(costs.resources.map(c => [this.normalizeResourceId(c.resourceId), c]));
    return nodes.map(n => {
      const cost = byId.get(this.normalizeResourceId(n.id));
      if (!cost) return n;
      return {
        ...n,
        costData: {
          monthlyCostUsd: cost.costUsd,
          currency: cost.currency,
          period: cost.billingPeriod,
          isEstimate: false,
          mappingState: 'matched',
        },
      };
    });
  }

  enrichNodesWithFinOps(nodes: DiagramNode[], payload: FinOpsV2Response): DiagramNode[] {
    const byId = new Map(payload.resources.map(r => [this.normalizeResourceId(r.resourceId), r]));
    const periodLabel = payload.periodPreset === 'mtd' ? 'Month to Date' : 'Last 30 Days';
    return nodes.map(n => {
      const row = byId.get(this.normalizeResourceId(n.id));
      if (!row) {
        return {
          ...n,
          costData: undefined,
        };
      }

      return {
        ...n,
        costData: {
          monthlyCostUsd: row.costInBaseCurrency,
          currency: payload.baseCurrency,
          period: periodLabel,
          isEstimate: false,
          mappingState: 'matched',
        },
      };
    });
  }

  normalizeResourceId(resourceId: string): string {
    return resourceId.trim().toLowerCase().replace(/\/+$/, '');
  }

  getCostBorderStyle(monthlyCostUsd: number): { borderWidth: string; borderColor: string } {
    if (monthlyCostUsd === 0) return { borderWidth: '1px', borderColor: '#605e5c' };
    if (monthlyCostUsd < 10)  return { borderWidth: '1px', borderColor: '#107c10' };
    if (monthlyCostUsd < 50)  return { borderWidth: '2px', borderColor: '#ffb900' };
    if (monthlyCostUsd < 200) return { borderWidth: '3px', borderColor: '#ca5010' };
    return                          { borderWidth: '4px', borderColor: '#d13438' };
  }

  getCostHeatmapGlow(monthlyCostUsd: number, maxCost: number): string {
    if (maxCost === 0 || monthlyCostUsd === 0) return 'none';
    const ratio = Math.min(monthlyCostUsd / maxCost, 1);
    if (ratio < 0.1)  return '0 0 4px 1px rgba(16,124,16,0.4)';
    if (ratio < 0.3)  return '0 0 8px 2px rgba(255,185,0,0.5)';
    if (ratio < 0.7)  return '0 0 12px 3px rgba(202,80,16,0.6)';
    return                   '0 0 16px 4px rgba(209,52,56,0.8)';
  }

  getOverlayLegend(): { label: string; color: string }[] {
    return [
      { label: 'Unknown / not mapped', color: '#605e5c' },
      { label: '< 10', color: '#107c10' },
      { label: '10 - 49', color: '#ffb900' },
      { label: '50 - 199', color: '#ca5010' },
      { label: '200+', color: '#d13438' },
    ];
  }

  toTopNodes(payload: FinOpsV2Response): { id: string; label: string; cost: number }[] {
    return payload.topResources.map(r => ({
      id: r.resourceId,
      label: r.resourceId.split('/').pop() || r.resourceId,
      cost: r.costInBaseCurrency,
    }));
  }

  getLegacySummaryFromV2(payload: FinOpsV2Response): SubscriptionCostSummary {
    const resources: CostQueryResponse[] = payload.resources.map(r => ({
      resourceId: r.resourceId,
      costUsd: r.costInBaseCurrency,
      currency: payload.baseCurrency,
      billingPeriod: payload.periodPreset === 'mtd' ? 'Month to Date' : 'Last 30 Days',
    }));

    const byResourceGroup: Record<string, number> = {};
    for (const row of payload.byResourceGroup) byResourceGroup[row.key] = row.value;
    const byResourceType: Record<string, number> = {};
    for (const row of payload.byResourceType) byResourceType[row.key] = row.value;

    return {
      totalUsd: payload.totalCostInBaseCurrency,
      currency: payload.baseCurrency,
      byResourceGroup,
      byResourceType,
      resources,
    };
  }
}
