import { Annotation, DrawingTool, EdgeMode, EdgeRouting, StrokeStyle } from '../../core/models/annotation.model';

export interface DrawingRuntimeState {
  isDrawing: boolean;
  drawPoints: [number, number][];
  shapeStart: { x: number; y: number } | null;
  previewPath: string;
  previewArrow: { x1: number; y1: number; x2: number; y2: number } | null;
  previewLine: { x1: number; y1: number; x2: number; y2: number } | null;
  previewRect: { x: number; y: number; w: number; h: number } | null;
  previewDiamond: { x: number; y: number; w: number; h: number } | null;
  previewEllipse: { cx: number; cy: number; rx: number; ry: number } | null;
}

export interface DrawingStyleState {
  activeTool: DrawingTool;
  activeColor: string;
  activeStrokeWidth: number;
  activeStrokeStyle: StrokeStyle;
  activeSloppiness: number;
  activeEdgeRouting: EdgeRouting;
  activeEdgeMode: EdgeMode;
  activeFill: string;
  activeFillOpacity: number;
}

export interface DrawingResult {
  next: DrawingRuntimeState;
  createdAnnotation?: Annotation;
  shouldStartEdit?: boolean;
}

export function resetDrawingRuntime(state: DrawingRuntimeState): DrawingRuntimeState {
  return {
    ...state,
    isDrawing: false,
    drawPoints: [],
    shapeStart: null,
    previewPath: '',
    previewArrow: null,
    previewLine: null,
    previewRect: null,
    previewDiamond: null,
    previewEllipse: null,
  };
}

export function onDrawStart(runtime: DrawingRuntimeState, style: DrawingStyleState, pt: { x: number; y: number }): DrawingResult {
  if (style.activeTool === 'text' || style.activeTool === 'sticky') {
    const ann = createAnnotation(style, 'text', pt.x, pt.y);
    if (style.activeTool === 'sticky') ann.type = 'sticky';
    return { next: runtime, createdAnnotation: ann, shouldStartEdit: true };
  }

  const next: DrawingRuntimeState = { ...runtime, isDrawing: true };
  if (style.activeTool === 'draw') {
    next.drawPoints = [[pt.x, pt.y]];
    next.previewPath = `M ${pt.x} ${pt.y}`;
  } else {
    next.shapeStart = pt;
  }
  return { next };
}

export function onDrawMove(runtime: DrawingRuntimeState, style: DrawingStyleState, pt: { x: number; y: number }): DrawingRuntimeState {
  if (!runtime.isDrawing) return runtime;
  const next: DrawingRuntimeState = { ...runtime };

  if (style.activeTool === 'draw') {
    next.drawPoints = [...runtime.drawPoints, [pt.x, pt.y]];
    next.previewPath = buildSmoothPath(next.drawPoints);
    return next;
  }

  if (!runtime.shapeStart) return next;
  const s = runtime.shapeStart;
  if (style.activeTool === 'arrow') {
    next.previewArrow = { x1: s.x, y1: s.y, x2: pt.x, y2: pt.y };
  } else if (style.activeTool === 'line') {
    next.previewLine = { x1: s.x, y1: s.y, x2: pt.x, y2: pt.y };
  } else if (style.activeTool === 'rect') {
    next.previewRect = normalizeRect(s.x, s.y, pt.x, pt.y);
  } else if (style.activeTool === 'diamond') {
    next.previewDiamond = normalizeRect(s.x, s.y, pt.x, pt.y);
  } else if (style.activeTool === 'ellipse') {
    const r = normalizeRect(s.x, s.y, pt.x, pt.y);
    next.previewEllipse = { cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 };
  }
  return next;
}

export function onDrawEnd(runtime: DrawingRuntimeState, style: DrawingStyleState, pt: { x: number; y: number }): DrawingResult {
  if (!runtime.isDrawing) return { next: runtime };

  let createdAnnotation: Annotation | undefined;
  if (style.activeTool === 'draw' && runtime.drawPoints.length > 1) {
    createdAnnotation = { ...createAnnotation(style, 'draw', 0, 0), pathData: buildSmoothPath(runtime.drawPoints) };
  } else if (runtime.shapeStart) {
    const s = runtime.shapeStart;
    if (style.activeTool === 'arrow') {
      const dx = pt.x - s.x; const dy = pt.y - s.y;
      if (Math.hypot(dx, dy) > 5) createdAnnotation = { ...createAnnotation(style, 'arrow', s.x, s.y), x2: pt.x, y2: pt.y };
    } else if (style.activeTool === 'line') {
      const dx = pt.x - s.x; const dy = pt.y - s.y;
      if (Math.hypot(dx, dy) > 5) createdAnnotation = { ...createAnnotation(style, 'line', s.x, s.y), x2: pt.x, y2: pt.y };
    } else if (style.activeTool === 'rect') {
      const r = normalizeRect(s.x, s.y, pt.x, pt.y);
      if (r.w > 4 && r.h > 4) createdAnnotation = { ...createAnnotation(style, 'rect', r.x, r.y), width: r.w, height: r.h, fill: style.activeFill };
    } else if (style.activeTool === 'diamond') {
      const r = normalizeRect(s.x, s.y, pt.x, pt.y);
      if (r.w > 4 && r.h > 4) createdAnnotation = { ...createAnnotation(style, 'diamond', r.x, r.y), width: r.w, height: r.h, fill: style.activeFill };
    } else if (style.activeTool === 'ellipse') {
      const r = normalizeRect(s.x, s.y, pt.x, pt.y);
      if (r.w > 4 && r.h > 4) createdAnnotation = { ...createAnnotation(style, 'ellipse', r.x, r.y), width: r.w, height: r.h, fill: style.activeFill };
    }
  }

  return { next: resetDrawingRuntime(runtime), createdAnnotation };
}

function createAnnotation(style: DrawingStyleState, type: Annotation['type'], x: number, y: number): Annotation {
  return {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    color: style.activeColor,
    strokeWidth: style.activeStrokeWidth,
    strokeStyle: style.activeStrokeStyle,
    sloppiness: style.activeSloppiness,
    edgeRouting: style.activeEdgeRouting,
    edgeMode: type === 'arrow' ? (style.activeEdgeMode === 'none' ? 'end' : style.activeEdgeMode) : style.activeEdgeMode,
    fillOpacity: style.activeFillOpacity,
    fill: style.activeFill,
    x,
    y,
    fontSize: 14,
  };
}

function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length === 1 ? `M ${pts[0][0]} ${pts[0][1]}` : '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  d += ` L ${pts.at(-1)![0]} ${pts.at(-1)![1]}`;
  return d;
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}
