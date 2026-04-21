import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { AzureSubscription } from '../../core/models/azure-resource.model';
import { CanvasVisibilityService } from './canvas-visibility.service';
import { SubscriptionBound } from './canvas.types';

interface ResolveParams {
  bounds: SubscriptionBound[];
  nodes: DiagramNode[];
  activeSubscriptions: AzureSubscription[];
  collapsedSubscriptions: Set<string>;
  collapsedResourceGroups: Set<string>;
  customContainerNames: Map<string, string>;
  moveSubscriptionGroup: (subscriptionId: string, delta: { dx: number; dy: number }) => void;
}

@Injectable({ providedIn: 'root' })
export class CanvasOverlapService {
  private isResolvingSubscriptionOverlaps = false;

  constructor(private visibilitySvc: CanvasVisibilityService) {}

  resolveSubscriptionContainerOverlaps(params: ResolveParams): void {
    const { bounds } = params;
    if (this.isResolvingSubscriptionOverlaps) return;
    if (bounds.length < 2) return;

    const gap = 24;
    const maxIters = 10;
    this.isResolvingSubscriptionOverlaps = true;
    try {
      for (let iter = 0; iter < maxIters; iter++) {
        let moved = false;
        const current = this.visibilitySvc.computeSubscriptionBounds(
          this.visibilitySvc.computeRgBounds(
            params.nodes.filter(n => !params.collapsedSubscriptions.has(n.metadata?.subscriptionId || '')),
            params.collapsedResourceGroups,
            params.customContainerNames,
          ),
          params.nodes,
          params.activeSubscriptions,
          params.collapsedSubscriptions,
          params.customContainerNames,
        );

        outer:
        for (let i = 0; i < current.length; i++) {
          for (let j = i + 1; j < current.length; j++) {
            const a = current[i];
            const b = current[j];
            if (!a.subscriptionId || !b.subscriptionId) continue;

            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const moveX = overlapX + gap;
            const moveY = overlapY + gap;

            if (moveX <= moveY) {
              params.moveSubscriptionGroup(b.subscriptionId, { dx: moveX, dy: 0 });
            } else {
              params.moveSubscriptionGroup(b.subscriptionId, { dx: 0, dy: moveY });
            }

            moved = true;
            break outer;
          }
        }

        if (!moved) break;
      }
    } finally {
      this.isResolvingSubscriptionOverlaps = false;
    }
  }
}
