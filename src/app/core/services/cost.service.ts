import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DiagramNode } from '../models/diagram-node.model';
import { CostQueryResponse, SubscriptionCostSummary } from '../models/cost-data.model';

@Injectable({ providedIn: 'root' })
export class CostService {
  constructor(private http: HttpClient) {}

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

  enrichNodesWithCosts(
    nodes: DiagramNode[],
    costs: SubscriptionCostSummary
  ): DiagramNode[] {
    const byId = new Map(costs.resources.map(c => [c.resourceId.toLowerCase(), c]));
    return nodes.map(n => {
      const cost = byId.get(n.id.toLowerCase());
      if (!cost) return n;
      return {
        ...n,
        costData: {
          monthlyCostUsd: cost.costUsd,
          currency: cost.currency,
          period: cost.billingPeriod,
          isEstimate: false,
        },
      };
    });
  }

  getCostBorderStyle(monthlyCostUsd: number): { borderWidth: string; borderColor: string } {
    if (monthlyCostUsd < 10)  return { borderWidth: '1px', borderColor: '#107c10' };
    if (monthlyCostUsd < 50)  return { borderWidth: '2px', borderColor: '#ffb900' };
    if (monthlyCostUsd < 200) return { borderWidth: '3px', borderColor: '#ca5010' };
    return                          { borderWidth: '4px', borderColor: '#d13438' };
  }

  getCostHeatmapGlow(monthlyCostUsd: number, maxCost: number): string {
    if (maxCost === 0) return 'none';
    const ratio = Math.min(monthlyCostUsd / maxCost, 1);
    if (ratio < 0.1)  return '0 0 4px 1px rgba(16,124,16,0.4)';
    if (ratio < 0.3)  return '0 0 8px 2px rgba(255,185,0,0.5)';
    if (ratio < 0.7)  return '0 0 12px 3px rgba(202,80,16,0.6)';
    return                   '0 0 16px 4px rgba(209,52,56,0.8)';
  }
}
