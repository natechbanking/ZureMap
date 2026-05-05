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

export interface K8sNamespaceBound {
  id: string;
  scopeId: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface K8sScopeBound {
  id: string;
  scopeId: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface K8sClusterBound {
  id: string;
  name: string;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TagRuleOperator = 'eq' | 'neq' | 'contains' | 'exists' | 'notexists';
export type HighlightRuleType = 'tag' | 'internal-item';

export interface TagRule {
  id: string;
  type: HighlightRuleType;
  tagKey?: string;
  operator?: TagRuleOperator;
  /** Unused for 'exists' / 'notexists' operators. */
  tagValue?: string;
  /** Used by tag rules to pick container level highlight. */
  target?: 'rg' | 'sub' | 'both' | 'node';
  /** Used by tag rules as highlight color. */
  color?: string;
  /** Optional badge text shown on container headers for tag rules. */
  badgeLabel?: string;
  /** Extra padding (px) added around the natural container bounds when rendering tag highlights. */
  sizeOffset?: { top: number; right: number; bottom: number; left: number };
  /** Used by internal-item rules to match label text by substring. Empty means "all". */
  textQuery?: string;
  /** Used by internal-item rules. */
  textColor?: string;
  /** Used by internal-item rules. */
  backgroundColor?: string;
}

export interface ResourceEditorDraft {
  label: string;
  location: string;
  resourceGroup: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  description: string;
  internalItems: { id: string; text: string; x: number; y: number; color?: string; backgroundColor?: string }[];
}

export interface ToolbarDragState {
  lastX: number;
  lastY: number;
}

export interface NodeDragState {
  id: string;
  ids: string[];
  lastX: number;
  lastY: number;
  hasMoved: boolean;
}

export interface SubscriptionDragState {
  subscriptionId: string;
  lastX: number;
  lastY: number;
}

export interface VmDragState {
  vmId: string;
  lastX: number;
  lastY: number;
}

export interface RgDragState {
  id: string;
  lastX: number;
  lastY: number;
}

export interface K8sNamespaceDragState {
  nsId: string;
  lastX: number;
  lastY: number;
}

export interface K8sScopeDragState {
  scopeId: string;
  lastX: number;
  lastY: number;
}

export interface K8sClusterDragState {
  clusterId: string;
  lastX: number;
  lastY: number;
}

export interface EdgeWaypointDragState {
  edgeId: string;
  waypointIndex: number;
  lastX: number;
  lastY: number;
}

export interface AnnWaypointDragState {
  annId: string;
  waypointIndex: number;
  lastX: number;
  lastY: number;
}

export interface EdgeLinkDragState {
  sourceNodeId?: string;
  sourceAnnotationId?: string;
  sourcePortId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
}

export interface SizeOffset { top: number; right: number; bottom: number; left: number }

export interface TagHighlightInfo {
  ruleId: string;
  borderColor: string;
  bgColor: string;
  badgeLabel?: string;
  sizeOffset?: SizeOffset;
}

export interface TagHighlightResizeDragState {
  ruleId: string;
  handle: string;
  startX: number;
  startY: number;
  startOffset: SizeOffset;
  currentOffset: SizeOffset;
}
