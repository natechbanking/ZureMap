import { CanvasCollapseService } from './canvas-collapse.service';
import { makeDiagramNode } from '../../testing/test-helpers';

describe('CanvasCollapseService', () => {
  let service: CanvasCollapseService;

  beforeEach(() => {
    service = new CanvasCollapseService();
  });

  it('toggleSubscription adds/removes ids and clears selection when collapsing selected subscription', () => {
    const selected = makeDiagramNode({ metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub1' } });

    const collapsed = service.toggleSubscription(new Set(), 'sub1', selected);
    expect(collapsed.next.has('sub1')).toBeTrue();
    expect(collapsed.clearSelection).toBeTrue();

    const expanded = service.toggleSubscription(collapsed.next, 'sub1', selected);
    expect(expanded.next.has('sub1')).toBeFalse();
    expect(expanded.clearSelection).toBeFalse();
  });

  it('toggleResourceGroup clears only when selected node is in that RG', () => {
    const selected = makeDiagramNode({ metadata: { ...makeDiagramNode().metadata, subscriptionId: 'sub1', resourceGroup: 'rg1' } });

    const result = service.toggleResourceGroup(new Set(), 'sub1::rg1', selected);
    expect(result.next.has('sub1::rg1')).toBeTrue();
    expect(result.clearSelection).toBeTrue();
  });

  it('toggleVm detects selected vm child membership', () => {
    const vm = makeDiagramNode({ id: 'vm1', children: ['nic1'] });
    const nic = makeDiagramNode({ id: 'nic1' });

    const result = service.toggleVm(new Set(), 'vm1', [vm, nic], nic);
    expect(result.next.has('vm1')).toBeTrue();
    expect(result.clearSelection).toBeTrue();
  });

  it('toggleRouteTable ignores unrelated selection', () => {
    const rt = makeDiagramNode({ id: 'rt1', children: ['route1'] });
    const selected = makeDiagramNode({ id: 'other' });

    const result = service.toggleRouteTable(new Set(), 'rt1', [rt, selected], selected);
    expect(result.next.has('rt1')).toBeTrue();
    expect(result.clearSelection).toBeFalse();
  });
});
