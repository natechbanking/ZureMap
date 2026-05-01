import { COST_ZERO_STYLE, getCostBorderStyle, getCostHeatmapGlow } from './cost-thresholds';

describe('cost-thresholds', () => {
  it('returns zero style for exact zero', () => {
    expect(getCostBorderStyle(0)).toEqual(COST_ZERO_STYLE);
  });

  it('maps values into expected border tiers', () => {
    expect(getCostBorderStyle(5)).toEqual({ borderWidth: '1px', borderColor: '#107c10' });
    expect(getCostBorderStyle(25)).toEqual({ borderWidth: '2px', borderColor: '#ffb900' });
    expect(getCostBorderStyle(150)).toEqual({ borderWidth: '3px', borderColor: '#ca5010' });
    expect(getCostBorderStyle(500)).toEqual({ borderWidth: '4px', borderColor: '#d13438' });
  });

  it('returns no heatmap when max or cost is zero', () => {
    expect(getCostHeatmapGlow(0, 100)).toBe('none');
    expect(getCostHeatmapGlow(10, 0)).toBe('none');
  });

  it('maps ratio to heatmap tiers and caps above max', () => {
    expect(getCostHeatmapGlow(5, 100)).toContain('rgba(16,124,16');
    expect(getCostHeatmapGlow(90, 100)).toContain('rgba(209,52,56');
    expect(getCostHeatmapGlow(200, 100)).toContain('rgba(209,52,56');
  });
});
