export type EdgeType =
  | 'privateLink'
  | 'vnetPeering'
  | 'subnetMembership'
  | 'serviceEndpoint'
  | 'managedIdentity'
  | 'dependency'
  | 'nsgAssociation';

export interface EdgeStyle {
  strokeColor: string;
  strokeWidth: number;
  dashArray?: string;
  markerEnd: 'arrow' | 'none';
}

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  label?: string;
  animated: boolean;
  style: EdgeStyle;
  waypoints?: { x: number; y: number }[];
}

export const EDGE_STYLES: Record<EdgeType, EdgeStyle> = {
  privateLink:       { strokeColor: '#0078d4', strokeWidth: 2, markerEnd: 'arrow' },
  vnetPeering:       { strokeColor: '#107c10', strokeWidth: 1.5, dashArray: '6 3', markerEnd: 'arrow' },
  subnetMembership:  { strokeColor: '#605e5c', strokeWidth: 1, markerEnd: 'none' },
  serviceEndpoint:   { strokeColor: '#0078d4', strokeWidth: 1.5, dashArray: '4 2', markerEnd: 'arrow' },
  managedIdentity:   { strokeColor: '#8764b8', strokeWidth: 1.5, dashArray: '6 3', markerEnd: 'arrow' },
  dependency:        { strokeColor: '#a19f9d', strokeWidth: 1, markerEnd: 'arrow' },
  nsgAssociation:    { strokeColor: '#ca5010', strokeWidth: 1, dashArray: '2 3', markerEnd: 'none' },
};
