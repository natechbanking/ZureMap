import { Annotation, EdgeRouting, StrokeStyle } from '../../core/models/annotation.model';
import { DiagramEdge } from '../../core/models/diagram-edge.model';
import { DiagramNode } from '../../core/models/diagram-node.model';

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

export function edgePolylinePoints(nodes: DiagramNode[], edge: Pick<DiagramEdge, 'sourceId' | 'targetId' | 'waypoints'>): { x: number; y: number }[] {
  const src = nodes.find(n => n.id === edge.sourceId);
  const tgt = nodes.find(n => n.id === edge.targetId);
  if (!src || !tgt) return [];

  const waypoints = edge.waypoints ?? [];
  const tgtCenter = { x: tgt.position.x + tgt.size.width / 2, y: tgt.position.y + tgt.size.height / 2 };
  const srcCenter = { x: src.position.x + src.size.width / 2, y: src.position.y + src.size.height / 2 };

  const firstTarget = waypoints.length > 0 ? waypoints[0] : tgtCenter;
  const lastSource = waypoints.length > 0 ? waypoints[waypoints.length - 1] : srcCenter;

  const srcAnchor = anchorTowardPoint(src, firstTarget);
  const tgtAnchor = anchorTowardPoint(tgt, lastSource);

  return [srcAnchor, ...waypoints, tgtAnchor];
}
