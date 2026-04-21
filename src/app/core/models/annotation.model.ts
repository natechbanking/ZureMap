export type DrawingTool = 'pointer' | 'draw' | 'line' | 'arrow' | 'text' | 'rect' | 'ellipse' | 'diamond' | 'sticky';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeRouting = 'straight' | 'elbow';
export type EdgeMode = 'none' | 'start' | 'end' | 'both';

export interface Annotation {
  id: string;
  type: Exclude<DrawingTool, 'pointer'>;
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
  waypoints?: { x: number; y: number }[];
  text?: string;      // text / sticky content
  fontSize?: number;
}
