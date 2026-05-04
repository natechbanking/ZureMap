import { Annotation, EdgeRouting, StrokeStyle } from '../../core/models/annotation.model';
import { DiagramEdge } from '../../core/models/diagram-edge.model';
import { DiagramNode, NodePort } from '../../core/models/diagram-node.model';

export function diamondPointsFromRect(r: { x: number; y: number; w: number; h: number }): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return `${cx},${r.y} ${r.x + r.w},${cy} ${cx},${r.y + r.h} ${r.x},${cy}`;
}

export function linePointsFromCoords(x1: number, y1: number, x2: number, y2: number, routing: EdgeRouting): string {
  if (routing === 'elbow' && (x1 !== x2 || y1 !== y2)) {
    const midX = x1 + (x2 - x1) / 2;
    return `${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  }
  return `${x1},${y1} ${x2},${y2}`;
}

export function strokeDashArrayForStyle(style: StrokeStyle): string | null {
  if (style === 'dashed') return '8 4';
  if (style === 'dotted') return '2 5';
  return null;
}

export function sloppyFilterForLevel(level: number): string | null {
  const v = Math.max(0, Math.min(3, Math.round(level)));
  if (v === 1) return 'url(#sloppy-1)';
  if (v === 2) return 'url(#sloppy-2)';
  if (v === 3) return 'url(#sloppy-3)';
  return null;
}

export function edgeAnchorBetween(nodes: DiagramNode[], fromId: string, toId: string): { x: number; y: number } {
  const from = nodes.find(n => n.id === fromId);
  const to = nodes.find(n => n.id === toId);
  if (!from || !to) return { x: 0, y: 0 };

  const fromCx = from.position.x + from.size.width / 2;
  const fromCy = from.position.y + from.size.height / 2;
  const toCx = to.position.x + to.size.width / 2;
  const toCy = to.position.y + to.size.height / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  if (dx === 0 && dy === 0) return { x: fromCx, y: fromCy };

  const halfW = from.size.width / 2;
  const halfH = from.size.height / 2;
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const t = Math.min(tx, ty);

  return {
    x: fromCx + dx * t,
    y: fromCy + dy * t,
  };
}

export function linePointsFromAnnotation(ann: Annotation): string {
  if (ann.waypoints && ann.waypoints.length > 0) {
    const all = [{ x: ann.x, y: ann.y }, ...ann.waypoints, { x: ann.x2 ?? ann.x, y: ann.y2 ?? ann.y }];
    return polylinePointsString(all);
  }
  return linePointsFromCoords(
    ann.x,
    ann.y,
    ann.x2 ?? ann.x,
    ann.y2 ?? ann.y,
    ann.edgeRouting ?? 'straight',
  );
}

export function anchorTowardPoint(node: DiagramNode, targetPt: { x: number; y: number }): { x: number; y: number } {
  const cx = node.position.x + node.size.width / 2;
  const cy = node.position.y + node.size.height / 2;
  const dx = targetPt.x - cx;
  const dy = targetPt.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = node.size.width / 2;
  const halfH = node.size.height / 2;
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function polylinePointsString(points: { x: number; y: number }[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

export const CONNECTABLE_ANNOTATION_TYPES = new Set(['rect', 'ellipse', 'diamond', 'image', 'text', 'sticky']);

function rotatePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  angleDeg: number,
): { x: number; y: number } {
  if (!angleDeg) return point;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function annotationBoundingBox(ann: Annotation): { x: number; y: number; width: number; height: number } {
  return {
    x: ann.x,
    y: ann.y,
    width: ann.width ?? (ann.type === 'sticky' ? 180 : ann.type === 'image' ? 240 : 200),
    height: ann.height ?? (ann.type === 'sticky' ? 120 : ann.type === 'image' ? 180 : 48),
  };
}

export function annotationPortPosition(ann: Annotation, portId: string): { x: number; y: number } | null {
  const { x, y, width: w, height: h } = annotationBoundingBox(ann);
  let pt: { x: number; y: number };
  switch (portId) {
    case 'port-top':    pt = { x: x + w * 0.5, y }; break;
    case 'port-right':  pt = { x: x + w,       y: y + h * 0.5 }; break;
    case 'port-bottom': pt = { x: x + w * 0.5, y: y + h }; break;
    case 'port-left':   pt = { x,              y: y + h * 0.5 }; break;
    default: return null;
  }
  if (ann.rotation) {
    const center = { x: x + w * 0.5, y: y + h * 0.5 };
    return rotatePoint(pt, center, ann.rotation);
  }
  return pt;
}

export function defaultNodePorts(): NodePort[] {
  return [
    { id: 'port-top', side: 'top' },
    { id: 'port-right', side: 'right' },
    { id: 'port-bottom', side: 'bottom' },
    { id: 'port-left', side: 'left' },
  ];
}

export function portPosition(node: DiagramNode, portId: string): { x: number; y: number } | null {
  const ports = node.ports ?? defaultNodePorts();
  const port = ports.find(p => p.id === portId);
  if (!port) return null;
  const { x, y } = node.position;
  const { width: w, height: h } = node.size;
  const off = port.offset ?? 0.5;
  let pt: { x: number; y: number };
  switch (port.side) {
    case 'top':    pt = { x: x + w * off, y }; break;
    case 'right':  pt = { x: x + w,       y: y + h * off }; break;
    case 'bottom': pt = { x: x + w * off, y: y + h }; break;
    case 'left':   pt = { x,              y: y + h * off }; break;
    default: return null;
  }
  if (node.angle) {
    const center = { x: x + w * 0.5, y: y + h * 0.5 };
    return rotatePoint(pt, center, node.angle);
  }
  return pt;
}

export function edgePolylinePoints(
  nodes: DiagramNode[],
  edge: Pick<DiagramEdge, 'sourceId' | 'targetId' | 'waypoints' | 'sourcePort' | 'targetPort' | 'sourceAnnotationId' | 'targetAnnotationId'>,
  nodeMap?: Map<string, DiagramNode>,
  annotationMap?: Map<string, Annotation>,
): { x: number; y: number }[] {
  const srcNode = nodeMap ? nodeMap.get(edge.sourceId) : nodes.find(n => n.id === edge.sourceId);
  const tgtNode = nodeMap ? nodeMap.get(edge.targetId) : nodes.find(n => n.id === edge.targetId);
  const srcAnn = edge.sourceAnnotationId ? annotationMap?.get(edge.sourceAnnotationId) : undefined;
  const tgtAnn = edge.targetAnnotationId ? annotationMap?.get(edge.targetAnnotationId) : undefined;

  if (!srcNode && !srcAnn) return [];
  if (!tgtNode && !tgtAnn) return [];

  const waypoints = edge.waypoints ?? [];

  // Center of each endpoint for fallback direction calculation
  const srcBb = srcNode
    ? { x: srcNode.position.x, y: srcNode.position.y, width: srcNode.size.width, height: srcNode.size.height }
    : annotationBoundingBox(srcAnn!);
  const tgtBb = tgtNode
    ? { x: tgtNode.position.x, y: tgtNode.position.y, width: tgtNode.size.width, height: tgtNode.size.height }
    : annotationBoundingBox(tgtAnn!);

  const srcCenter = { x: srcBb.x + srcBb.width / 2, y: srcBb.y + srcBb.height / 2 };
  const tgtCenter = { x: tgtBb.x + tgtBb.width / 2, y: tgtBb.y + tgtBb.height / 2 };

  const firstTarget = waypoints.length > 0 ? waypoints[0] : tgtCenter;
  const lastSource  = waypoints.length > 0 ? waypoints[waypoints.length - 1] : srcCenter;

  const pseudoSrc = srcNode ?? { position: { x: srcBb.x, y: srcBb.y }, size: { width: srcBb.width, height: srcBb.height } } as DiagramNode;
  const pseudoTgt = tgtNode ?? { position: { x: tgtBb.x, y: tgtBb.y }, size: { width: tgtBb.width, height: tgtBb.height } } as DiagramNode;

  const srcAnchor = srcNode
    ? (edge.sourcePort ? portPosition(srcNode, edge.sourcePort) : null) ?? anchorTowardPoint(pseudoSrc, firstTarget)
    : (edge.sourcePort ? annotationPortPosition(srcAnn!, edge.sourcePort) : null) ?? anchorTowardPoint(pseudoSrc, firstTarget);

  const tgtAnchor = tgtNode
    ? (edge.targetPort ? portPosition(tgtNode, edge.targetPort) : null) ?? anchorTowardPoint(pseudoTgt, lastSource)
    : (edge.targetPort ? annotationPortPosition(tgtAnn!, edge.targetPort) : null) ?? anchorTowardPoint(pseudoTgt, lastSource);

  return [srcAnchor, ...waypoints, tgtAnchor];
}

export function pathMax(pathData: string): { x: number; y: number } {
  const nums = pathData.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return { x: 0, y: 0 };
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < nums.length - 1; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) return { x: 0, y: 0 };
  return { x: maxX, y: maxY };
}

export function rotatedBounds(
  x: number, y: number, width: number, height: number, rotationDeg: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const points = [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
  ].map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
  return {
    minX: Math.min(...points.map(p => p.x)),
    maxX: Math.max(...points.map(p => p.x)),
    minY: Math.min(...points.map(p => p.y)),
    maxY: Math.max(...points.map(p => p.y)),
  };
}

export function annotationTextWidth(ann: Annotation): number {
  return ann.width ?? (ann.type === 'sticky' ? 180 : 200);
}

export function annotationTextHeight(ann: Annotation): number {
  return ann.height ?? (ann.type === 'sticky' ? 120 : 48);
}

export function annotationTransform(ann: Annotation): string {
  const rot = ann.rotation ?? 0;
  if (!rot) return '';
  return `rotate(${rot}deg)`;
}

export function annotationMaxX(ann: Annotation): number {
  if (ann.type === 'arrow' || ann.type === 'line') return Math.max(ann.x, ann.x2 ?? ann.x);
  if (ann.type === 'rect' || ann.type === 'diamond' || ann.type === 'ellipse' || ann.type === 'image') return ann.x + (ann.width ?? 0);
  if (ann.type === 'draw' && ann.pathData) return pathMax(ann.pathData).x;
  if (ann.type === 'text' || ann.type === 'sticky') {
    if ((ann.rotation ?? 0) !== 0) {
      const box = rotatedBounds(ann.x, ann.y, annotationTextWidth(ann), annotationTextHeight(ann), ann.rotation ?? 0);
      return box.maxX;
    }
    return ann.x + annotationTextWidth(ann);
  }
  return ann.x + (ann.width ?? 200);
}

export function annotationMaxY(ann: Annotation): number {
  if (ann.type === 'arrow' || ann.type === 'line') return Math.max(ann.y, ann.y2 ?? ann.y);
  if (ann.type === 'rect' || ann.type === 'diamond' || ann.type === 'ellipse' || ann.type === 'image') return ann.y + (ann.height ?? 0);
  if (ann.type === 'draw' && ann.pathData) return pathMax(ann.pathData).y;
  if (ann.type === 'text' || ann.type === 'sticky') {
    if ((ann.rotation ?? 0) !== 0) {
      const box = rotatedBounds(ann.x, ann.y, annotationTextWidth(ann), annotationTextHeight(ann), ann.rotation ?? 0);
      return box.maxY;
    }
    return ann.y + annotationTextHeight(ann);
  }
  return ann.y + (ann.height ?? 80);
}

export function annotationBounds(ann: Annotation): { minX: number; minY: number; maxX: number; maxY: number } {
  const minX = ann.type === 'arrow' || ann.type === 'line' ? Math.min(ann.x, ann.x2 ?? ann.x) : ann.x;
  const minY = ann.type === 'arrow' || ann.type === 'line' ? Math.min(ann.y, ann.y2 ?? ann.y) : ann.y;
  return { minX, minY, maxX: annotationMaxX(ann), maxY: annotationMaxY(ann) };
}
