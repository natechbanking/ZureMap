export interface RgBound {
  id: string;
  subscriptionId: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SubscriptionBound {
  id: string;
  subscriptionId: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VmBound {
  id: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteTableBound {
  id: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResourceEditorDraft {
  label: string;
  location: string;
  resourceGroup: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  description: string;
  internalItems: Array<{ id: string; text: string; x: number; y: number }>;
}
