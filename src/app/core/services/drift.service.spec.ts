import { DriftService } from './drift.service';
import { makeDiagramNode } from '../../testing/test-helpers';

describe('DriftService', () => {
  let service: DriftService;

  beforeEach(() => {
    service = new DriftService();
  });

  it('marks live nodes as matched/unplanned and adds missing baseline nodes', () => {
    const baseline = [
      makeDiagramNode({ id: 'a' }),
      makeDiagramNode({ id: 'b' }),
    ];
    const live = [
      makeDiagramNode({ id: 'a' }),
      makeDiagramNode({ id: 'c' }),
    ];

    const result = service.computeDrift(baseline, live);

    expect(result.find(n => n.id === 'a')?.driftStatus).toBe('matched');
    expect(result.find(n => n.id === 'c')?.driftStatus).toBe('unplanned');
    expect(result.find(n => n.id === 'b')?.driftStatus).toBe('missing');
    expect(result.find(n => n.id === 'b')?.highlighted).toBeTrue();
  });

  it('delegates cost border style helper', () => {
    expect(service.getCostBorderStyle(300)).toEqual({ borderWidth: '4px', borderColor: '#d13438' });
  });
});
