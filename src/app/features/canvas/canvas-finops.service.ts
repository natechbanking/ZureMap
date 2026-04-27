import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { FinOpsRequestParams, FinOpsV2Response } from '../../core/models/cost-data.model';
import { CostService } from '../../core/services/cost.service';

@Injectable({ providedIn: 'root' })
export class CanvasFinopsService {
  constructor(private costSvc: CostService) {}

  async loadFinOps(
    nodes: DiagramNode[],
    params: FinOpsRequestParams
  ): Promise<{ nodes: DiagramNode[]; payload: FinOpsV2Response | null }> {
    const payload = await firstValueFrom(this.costSvc.getFinOpsV2(params));
    if (!payload) {
      return { nodes: nodes.map(n => ({ ...n, costData: undefined })), payload: null };
    }

    const nextNodes = this.costSvc.enrichNodesWithFinOps(nodes, payload);
    return { nodes: nextNodes, payload };
  }
}
