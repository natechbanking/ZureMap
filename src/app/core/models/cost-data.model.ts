export interface NodeCostData {
  monthlyCostUsd: number;
  currency: string;
  period: string;
  isEstimate: boolean;
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
