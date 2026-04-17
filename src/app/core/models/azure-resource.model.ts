export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscriptionId: string;
  tags: Record<string, string>;
  properties: Record<string, unknown>;
  sku?: { name: string; tier?: string; capacity?: number };
  kind?: string;
}

export interface AzureSubscription {
  id: string;
  subscriptionId: string;
  name: string;
  state: string;
  tenantId: string;
}

export interface AzureAccount {
  id: string;
  name: string;
  user: { name: string; type: string };
  tenantId: string;
}
