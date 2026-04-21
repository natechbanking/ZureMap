import { AzureResource } from './azure-resource.model';
import { NodeCostData } from './cost-data.model';

export type NodeStatus = 'running' | 'stopped' | 'failed' | 'unknown';
export type LayoutGroup = 'resourceGroup' | 'vnet' | 'subnet' | 'standalone';
export type DriftStatus = 'matched' | 'missing' | 'unplanned';

export interface NodeInternalItem {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface NodeCustomization {
  description?: string;
  internalItems?: NodeInternalItem[];
}

export interface DiagramNode {
  id: string;
  label: string;
  resourceType: string;
  iconUrl: string;
  group: LayoutGroup;
  groupId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children?: string[];
  parentId?: string;
  isPinned: boolean;
  manualPosition?: { x: number; y: number };
  status: NodeStatus;
  metadata: AzureResource;
  costData?: NodeCostData;
  selected: boolean;
  highlighted: boolean;
  driftStatus?: DriftStatus;
  custom?: NodeCustomization;
}
