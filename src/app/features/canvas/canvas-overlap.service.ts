import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { AzureSubscription } from '../../core/models/azure-resource.model';
import { SubscriptionBound } from './canvas.types';

interface ResolveParams {
  bounds: SubscriptionBound[];
  nodes: DiagramNode[];
  activeSubscriptions: AzureSubscription[];
  collapsedSubscriptions: Set<string>;
  collapsedResourceGroups: Set<string>;
  customContainerNames: Map<string, string>;
  draggedSubscriptionId?: string;
  moveSubscriptionGroup: (subscriptionId: string, delta: { dx: number; dy: number }) => void;
}

@Injectable({ providedIn: 'root' })
export class CanvasOverlapService {
  private isResolvingSubscriptionOverlaps = false;

  resolveSubscriptionContainerOverlaps(params: ResolveParams): void {
    const { bounds } = params;
    if (this.isResolvingSubscriptionOverlaps) return;
    if (bounds.length < 2) return;

    const gap = 24;
    const maxIters = 24;
    this.isResolvingSubscriptionOverlaps = true;
    try {
      // Work against a lightweight bounds snapshot and only apply node moves once.
      // Recomputing bounds from all nodes each pass can be extremely expensive for
      // large subscriptions and may trigger OOM during drag-collision resolution.
      const current = bounds
        .filter(b => !!b.subscriptionId)
        .map(b => ({ ...b }));
      if (current.length < 2) return;

      const totalDelta = new Map<string, { dx: number; dy: number }>();

      for (let iter = 0; iter < maxIters; iter++) {
        let moved = false;

        for (let i = 0; i < current.length; i++) {
          for (let j = i + 1; j < current.length; j++) {
            const a = current[i];
            const b = current[j];
            if (!a.subscriptionId || !b.subscriptionId) continue;

            // Overlap is positive when penetrating, negative when apart.
            // Start pushing once containers are within `gap` of each other in both axes.
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (overlapX <= -gap || overlapY <= -gap) continue;

            // Push amount restores exactly `gap` clearance between the two containers.
            const moveX = overlapX + gap;
            const moveY = overlapY + gap;

            // Never push the container currently being dragged — push the other one.
            // When neither is dragged, choose the axis with the smaller displacement
            // and push the container that is further in that direction.
            const aIsDragged = a.subscriptionId === params.draggedSubscriptionId;
            const bIsDragged = b.subscriptionId === params.draggedSubscriptionId;

            if (moveX <= moveY) {
              // Resolve horizontally
              const pushTarget = aIsDragged || (!bIsDragged && a.x <= b.x) ? b : a;
              const sign = pushTarget === b ? 1 : -1;
              const dx = moveX * sign;
              pushTarget.x += dx;
              const prev = totalDelta.get(pushTarget.subscriptionId) ?? { dx: 0, dy: 0 };
              totalDelta.set(pushTarget.subscriptionId, { dx: prev.dx + dx, dy: prev.dy });
            } else {
              // Resolve vertically
              const pushTarget = aIsDragged || (!bIsDragged && a.y <= b.y) ? b : a;
              const sign = pushTarget === b ? 1 : -1;
              const dy = moveY * sign;
              pushTarget.y += dy;
              const prev = totalDelta.get(pushTarget.subscriptionId) ?? { dx: 0, dy: 0 };
              totalDelta.set(pushTarget.subscriptionId, { dx: prev.dx, dy: prev.dy + dy });
            }

            moved = true;
          }
        }

        if (!moved) break;
      }

      for (const [subscriptionId, delta] of totalDelta) {
        if (!delta.dx && !delta.dy) continue;
        params.moveSubscriptionGroup(subscriptionId, delta);
      }
    } finally {
      this.isResolvingSubscriptionOverlaps = false;
    }
  }
}
