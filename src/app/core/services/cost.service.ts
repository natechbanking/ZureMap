import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { normalizeResourceId } from '../utils/resource-id.utils';
import { getCostBorderStyle, getCostHeatmapGlow, CostBorderStyle } from '../utils/cost-thresholds';
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
    return normalizeResourceId(resourceId);
  }

  getCostBorderStyle(monthlyCostUsd: number): CostBorderStyle {
    return getCostBorderStyle(monthlyCostUsd);
  }

  getCostHeatmapGlow(monthlyCostUsd: number, maxCost: number): string {
    return getCostHeatmapGlow(monthlyCostUsd, maxCost);
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
