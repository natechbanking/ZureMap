export interface ContextMenuRequest {
  nodeId: string;
  x: number;
  y: number;
}

export interface InternalItemMoveRequest {
  nodeId: string;
  itemId: string;
  x: number;
  y: number;
}

export interface NodeResizeRequest {
  nodeId: string;
  width: number;
  height: number;
}

export interface NodeRotateRequest {
  nodeId: string;
  angle: number;
}

export interface RouteTableExpansionRequest {
  nodeId: string;
  expanded: boolean;
  routeCount: number;
}

export interface VirtualNetworkExpansionRequest {
  nodeId: string;
  expanded: boolean;
  subnetCount: number;
}

export interface NsgExpansionRequest {
  nodeId: string;
  expanded: boolean;
  ruleCount: number;
}

export interface StorageAccountExpansionRequest {
  nodeId: string;
  expanded: boolean;
  itemCount: number;
}

export interface AksExpansionRequest {
  nodeId: string;
  expanded: boolean;
  nodePoolCount: number;
}

export interface VmExpansionRequest {
  nodeId: string;
  expanded: boolean;
}

export interface UaiExpansionRequest {
  nodeId: string;
  expanded: boolean;
  assignmentCount: number;
}

export interface HostingEnvironmentExpansionRequest {
  nodeId: string;
  expanded: boolean;
  statCount: number;
}

export interface ServerFarmExpansionRequest {
  nodeId: string;
  expanded: boolean;
  statCount: number;
}

export interface PublicIpExpansionRequest {
  nodeId: string;
  expanded: boolean;
  detailCount: number;
}

export interface ScheduleExpansionRequest {
  nodeId: string;
  expanded: boolean;
  detailCount: number;
}

export interface DiskExpansionRequest {
  nodeId: string;
  expanded: boolean;
  detailCount: number;
}

export interface AzureFirewallExpansionRequest {
  nodeId: string;
  expanded: boolean;
  detailCount: number;
}

export interface ApplicationGatewayExpansionRequest {
  nodeId: string;
  expanded: boolean;
  detailCount: number;
}

export interface ConnectionExpansionRequest {
  nodeId: string;
  expanded: boolean;
  detailCount: number;
}

export interface DnsZoneExpansionRequest {
  nodeId: string;
  expanded: boolean;
  recordCount: number;
}
