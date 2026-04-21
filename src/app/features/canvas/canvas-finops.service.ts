import { Injectable } from '@angular/core';
import { CostService } from '../../core/services/cost.service';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { forkJoin, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CanvasFinopsService {
  constructor(private costSvc: CostService) {}

  async loadCostsForSubscriptions(nodes: DiagramNode[], subscriptionIds: string[]): Promise<{ nodes: DiagramNode[]; loadedSubscriptions: number }> {
    const responses = await firstValueFrom(
      forkJoin(subscriptionIds.map(subscriptionId => this.costSvc.getSubscriptionCosts(subscriptionId)))
    );
    const summaries = responses.filter((r): r is NonNullable<typeof r> => r !== null);
    let nextNodes: DiagramNode[] = nodes.map(n => ({ ...n, costData: undefined }));
    for (const summary of summaries) {
      nextNodes = this.costSvc.enrichNodesWithCosts(nextNodes, summary);
    }
    return { nodes: nextNodes, loadedSubscriptions: summaries.length };
  }
}
