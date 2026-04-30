import { Injectable } from '@angular/core';
import { DiagramNode } from '../models/diagram-node.model';
import { getCostBorderStyle, CostBorderStyle } from '../utils/cost-thresholds';

@Injectable({ providedIn: 'root' })
export class DriftService {

  computeDrift(baseline: DiagramNode[], live: DiagramNode[]): DiagramNode[] {
    const liveIds = new Set(live.map(n => n.id));
    const baselineIds = new Set(baseline.map(n => n.id));

    const enrichedLive = live.map(n => ({
      ...n,
      driftStatus: (baselineIds.has(n.id) ? 'matched' : 'unplanned') as DiagramNode['driftStatus'],
    }));

    const missingNodes: DiagramNode[] = baseline
      .filter(n => !liveIds.has(n.id))
      .map(n => ({
        ...n,
        driftStatus: 'missing' as const,
        highlighted: true,
      }));

    return [...enrichedLive, ...missingNodes];
  }

  getCostBorderStyle(monthlyCostUsd: number): CostBorderStyle {
    return getCostBorderStyle(monthlyCostUsd);
  }
}
