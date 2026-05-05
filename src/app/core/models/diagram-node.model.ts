import { AzureResource } from './azure-resource.model';
import { NodeCostData } from './cost-data.model';

export type NodeStatus = 'running' | 'stopped' | 'failed' | 'unknown';
export type LayoutGroup = 'resourceGroup' | 'vnet' | 'subnet' | 'standalone' | 'k8sNamespace';
export type DriftStatus = 'matched' | 'missing' | 'unplanned';
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

export interface NodePort {
  id: string;
  side: PortSide;
  /** 0.0–1.0 position along the side; defaults to 0.5 (center). */
  offset?: number;
}

export interface NodeInternalItem {
  id: string;
  text: string;
  x: number;
  y: number;
  /**
   * User-set base color. Internal-item style rules may override `color` but
   * always preserve `baseColor` so that removing a rule reverts the item to
   * its original appearance.
   */
  baseColor?: string;
  color?: string;
  /**
   * User-set base background color. Internal-item style rules may override
   * `backgroundColor` but always preserve `baseBackgroundColor`.
   */
  baseBackgroundColor?: string;
  backgroundColor?: string;
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
  status: NodeStatus;
  metadata: AzureResource;
  costData?: NodeCostData;
  selected: boolean;
  highlighted: boolean;
  driftStatus?: DriftStatus;
  custom?: NodeCustomization;
  angle?: number;
  ports?: NodePort[];
}
