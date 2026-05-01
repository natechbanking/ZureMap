import { CanvasOverlapService } from './canvas-overlap.service';
import { SubscriptionBound } from './canvas.types';

describe('CanvasOverlapService', () => {
  let service: CanvasOverlapService;

  beforeEach(() => {
    service = new CanvasOverlapService();
  });

  function bound(subscriptionId: string, x: number, y: number): SubscriptionBound {
    return { id: subscriptionId, subscriptionId, name: subscriptionId, collapsed: false, x, y, width: 100, height: 100 };
  }

  it('does nothing for fewer than 2 bounds', () => {
    const moveSpy = jasmine.createSpy('move');
    service.resolveSubscriptionContainerOverlaps({
      bounds: [bound('sub1', 0, 0)],
      nodes: [],
      activeSubscriptions: [],
      collapsedSubscriptions: new Set(),
      collapsedResourceGroups: new Set(),
      customContainerNames: new Map(),
      moveSubscriptionGroup: moveSpy,
    });

    expect(moveSpy).not.toHaveBeenCalled();
  });

  it('moves only non-dragged subscription on overlap', () => {
    const moveSpy = jasmine.createSpy('move');
    service.resolveSubscriptionContainerOverlaps({
      bounds: [bound('sub1', 0, 0), bound('sub2', 50, 0)],
      nodes: [],
      activeSubscriptions: [],
      collapsedSubscriptions: new Set(),
      collapsedResourceGroups: new Set(),
      customContainerNames: new Map(),
      draggedSubscriptionId: 'sub1',
      moveSubscriptionGroup: moveSpy,
    });

    expect(moveSpy).toHaveBeenCalledTimes(1);
    expect(moveSpy).toHaveBeenCalledWith('sub2', jasmine.objectContaining({ dx: jasmine.any(Number), dy: 0 }));
  });

  it('does nothing when containers already have required gap', () => {
    const moveSpy = jasmine.createSpy('move');
    service.resolveSubscriptionContainerOverlaps({
      bounds: [bound('sub1', 0, 0), bound('sub2', 200, 0)],
      nodes: [],
      activeSubscriptions: [],
      collapsedSubscriptions: new Set(),
      collapsedResourceGroups: new Set(),
      customContainerNames: new Map(),
      moveSubscriptionGroup: moveSpy,
    });

    expect(moveSpy).not.toHaveBeenCalled();
  });
});
