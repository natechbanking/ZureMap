export type DrawingTool =
  | 'pointer'
  | 'hand'
  | 'eraser'
  | 'draw'
  | 'line'
  | 'arrow'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'sticky'
  | 'resource'
  | 'rgContainer'
  | 'subscriptionContainer';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeRouting = 'straight' | 'elbow';
export type EdgeMode = 'none' | 'start' | 'end' | 'both';
export type AnnotationType = 'draw' | 'line' | 'arrow' | 'text' | 'rect' | 'ellipse' | 'diamond' | 'sticky' | 'image';

export interface AnnotationEndpointBinding {
  nodeId?: string;
  annotationId?: string;
  portId: string;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  strokeStyle?: StrokeStyle;
  sloppiness?: number; // 0 (clean) .. 3 (rough)
  edgeRouting?: EdgeRouting;
  edgeMode?: EdgeMode;
  fill: string;       // 'none' or a hex color
  fillOpacity?: number; // 0..1
  x: number;
  y: number;
  pathData?: string;  // freehand
  width?: number;     // rect / ellipse / sticky / text box
  height?: number;
  x2?: number;        // arrow endpoint
  y2?: number;
  sourceBinding?: AnnotationEndpointBinding;
  targetBinding?: AnnotationEndpointBinding;
  waypoints?: { x: number; y: number }[];
  text?: string;      // text / sticky content
  fontSize?: number;
  fontFamily?: string;
  rotation?: number;  // degrees, clockwise
  imageDataUrl?: string;
  container?: {
    kind: 'rg' | 'sub';
    name: string;
    collapsed: boolean;
  };
}
