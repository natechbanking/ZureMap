export type DrawingTool = 'pointer' | 'draw' | 'arrow' | 'text' | 'rect' | 'ellipse' | 'sticky';

export interface Annotation {
  id: string;
  type: Exclude<DrawingTool, 'pointer'>;
  color: string;
  strokeWidth: number;
  fill: string;       // 'none' or a hex color
  x: number;
  y: number;
  pathData?: string;  // freehand
  width?: number;     // rect / ellipse / sticky / text box
  height?: number;
  x2?: number;        // arrow endpoint
  y2?: number;
  text?: string;      // text / sticky content
  fontSize?: number;
}
