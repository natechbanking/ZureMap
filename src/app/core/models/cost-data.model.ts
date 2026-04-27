export interface NodeCostData {
  monthlyCostUsd: number;
  currency: string;
  period: string;
  isEstimate: boolean;
  mappingState?: 'matched' | 'unknown';
}

export interface CostQueryResponse {
  resourceId: string;
  costUsd: number;
  currency: string;
  billingPeriod: string;
}

export interface SubscriptionCostSummary {
  totalUsd: number;
  currency: string;
  byResourceGroup: Record<string, number>;
  byResourceType: Record<string, number>;
  resources: CostQueryResponse[];
}

export type FinOpsPeriodPreset = 'mtd' | 'last30';

export interface FinOpsRequestParams {
  periodPreset: FinOpsPeriodPreset;
  filters: {
    subscriptionIds: string[];
    resourceGroup: string[];
    resourceType: string[];
  };
  includeTrend: boolean;
  baseCurrency: string;
  resourceIds: string[];
}

export interface FinOpsTrendPoint {
  date: string;
  value: number;
}

export interface FinOpsBreakdownRow {
  key: string;
  value: number;
}

export interface FinOpsSubscriptionStatus {
  subscriptionId: string;
  status: 'success' | 'failed';
  reason?: string;
  originalCurrency?: string;
  conversionRateToBase?: number;
  loadedRows?: number;
}

export interface FinOpsDiagnostics {
  requestedResourceCount: number;
  matchedResourceCount: number;
  unmatchedResourceCount: number;
  sampleUnmatchedResourceIds: string[];
  matchedCostRowCount: number;
  unmatchedCostRowCount: number;
  sampleUnmatchedCostResourceIds: string[];
}

export interface FinOpsResourceRow {
  subscriptionId: string;
  resourceId: string;
  normalizedResourceId: string;
  resourceGroup: string;
  resourceType: string;
  originalCost: number;
  originalCurrency: string;
  costInBaseCurrency: number;
}

export interface FinOpsV2Response {
  periodPreset: FinOpsPeriodPreset;
  baseCurrency: string;
  totalCostInBaseCurrency: number;
  costedResourceCount: number;
  loadedSubscriptionCount: number;
  failedSubscriptionCount: number;
  subscriptions: FinOpsSubscriptionStatus[];
  resources: FinOpsResourceRow[];
  topResources: FinOpsResourceRow[];
  byResourceGroup: FinOpsBreakdownRow[];
  byResourceType: FinOpsBreakdownRow[];
  trend: FinOpsTrendPoint[];
  diagnostics: FinOpsDiagnostics;
  warnings: string[];
  conversion: {
    source: string;
    asOf: string;
    ratesToBase: Record<string, number>;
  };
}
