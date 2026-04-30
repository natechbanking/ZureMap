export interface CostBorderStyle {
  borderWidth: string;
  borderColor: string;
}

export const COST_ZERO_STYLE: CostBorderStyle = { borderWidth: '1px', borderColor: '#605e5c' };

/** Tiers checked in order via strict `cost < upperBound`. Excludes the zero/free tier. */
const COST_TIERS: readonly { upperBound: number; borderWidth: string; borderColor: string }[] = [
  { upperBound: 10,  borderWidth: '1px', borderColor: '#107c10' },
  { upperBound: 50,  borderWidth: '2px', borderColor: '#ffb900' },
  { upperBound: 200, borderWidth: '3px', borderColor: '#ca5010' },
] as const;

interface HeatmapTier {
  ratio: number;
  glow: string;
}

export const COST_HEATMAP_TIERS: readonly HeatmapTier[] = [
  { ratio: 0.1, glow: '0 0 4px 1px rgba(16,124,16,0.4)' },
  { ratio: 0.3, glow: '0 0 8px 2px rgba(255,185,0,0.5)' },
  { ratio: 0.7, glow: '0 0 12px 3px rgba(202,80,16,0.6)' },
  { ratio: 1.0, glow: '0 0 16px 4px rgba(209,52,56,0.8)' },
] as const;

export function getCostBorderStyle(monthlyCostUsd: number): CostBorderStyle {
  if (monthlyCostUsd === 0) return COST_ZERO_STYLE;
  for (const tier of COST_TIERS) {
    if (monthlyCostUsd < tier.upperBound) {
      return { borderWidth: tier.borderWidth, borderColor: tier.borderColor };
    }
  }
  return { borderWidth: '4px', borderColor: '#d13438' };
}

export function getCostHeatmapGlow(monthlyCostUsd: number, maxCost: number): string {
  if (maxCost === 0 || monthlyCostUsd === 0) return 'none';
  const ratio = Math.min(monthlyCostUsd / maxCost, 1);
  for (const tier of COST_HEATMAP_TIERS) {
    if (ratio < tier.ratio) return tier.glow;
  }
  return COST_HEATMAP_TIERS[COST_HEATMAP_TIERS.length - 1].glow;
}
