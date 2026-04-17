import { Injectable } from '@angular/core';
import { DiagramNode } from '../models/diagram-node.model';

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

  getCostBorderStyle(monthlyCostUsd: number): { borderWidth: string; borderColor: string } {
    if (monthlyCostUsd < 10)  return { borderWidth: '1px', borderColor: '#107c10' };
    if (monthlyCostUsd < 50)  return { borderWidth: '2px', borderColor: '#ffb900' };
    if (monthlyCostUsd < 200) return { borderWidth: '3px', borderColor: '#ca5010' };
    return                          { borderWidth: '4px', borderColor: '#d13438' };
  }
}
