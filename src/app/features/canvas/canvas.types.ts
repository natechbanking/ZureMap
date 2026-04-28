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

export type TagRuleOperator = 'eq' | 'neq' | 'contains' | 'exists' | 'notexists';

/** A single tag-based highlighting rule evaluated against an RG or subscription. */
export interface TagRule {
  id: string;
  tagKey: string;
  operator: TagRuleOperator;
  /** Unused for 'exists' / 'notexists' operators. */
  tagValue: string;
  /** Which container level to highlight. */
  target: 'rg' | 'sub' | 'both' | 'node';
  color: string;
  /** Optional badge text shown on the container header. */
  badgeLabel?: string;
  /** Extra padding (px) added around the natural container bounds when rendering the highlight. */
  sizeOffset?: { top: number; right: number; bottom: number; left: number };
}

export interface ResourceEditorDraft {
  label: string;
  location: string;
  resourceGroup: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  description: string;
  internalItems: { id: string; text: string; x: number; y: number }[];
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
