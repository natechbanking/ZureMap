import { Injectable } from '@angular/core';
import { Annotation, EdgeMode } from '../../core/models/annotation.model';

@Injectable({ providedIn: 'root' })
export class CanvasAnnotationService {
  duplicate(source: Annotation): Annotation {
    return {
      ...source,
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: source.x + 20,
      y: source.y + 20,
      x2: source.x2 !== undefined ? source.x2 + 20 : undefined,
      y2: source.y2 !== undefined ? source.y2 + 20 : undefined,
      sourceBinding: undefined,
      targetBinding: undefined,
    };
  }

  bringToFront(list: Annotation[], id: string): Annotation[] {
    const idx = list.findIndex(a => a.id === id);
    if (idx < 0 || idx === list.length - 1) return list;
    const picked = list[idx];
    return [...list.slice(0, idx), ...list.slice(idx + 1), picked];
  }

  sendToBack(list: Annotation[], id: string): Annotation[] {
    const idx = list.findIndex(a => a.id === id);
    if (idx <= 0) return list;
    const picked = list[idx];
    return [picked, ...list.slice(0, idx), ...list.slice(idx + 1)];
  }

  deleteButtonX(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') return Math.max(ann.x, ann.x2 ?? ann.x) + 8;
    return ann.x + (ann.width ?? 120) + 4;
  }

  deleteButtonY(ann: Annotation): number {
    if (ann.type === 'arrow' || ann.type === 'line') return Math.min(ann.y, ann.y2 ?? ann.y) - 10;
    return ann.y - 10;
  }

  markerStart(ann: Annotation): string | null {
    const mode = this.edgeModeFor(ann);
    return mode === 'start' || mode === 'both' ? 'url(#ann-arrow)' : null;
  }

  markerEnd(ann: Annotation): string | null {
    const mode = this.edgeModeFor(ann);
    return mode === 'end' || mode === 'both' ? 'url(#ann-arrow)' : null;
  }

  previewMarkerStart(activeEdgeMode: EdgeMode): string | null {
    return activeEdgeMode === 'start' || activeEdgeMode === 'both' ? 'url(#ann-arrow)' : null;
  }

  previewMarkerEnd(activeEdgeMode: EdgeMode): string | null {
    return activeEdgeMode === 'end' || activeEdgeMode === 'both' ? 'url(#ann-arrow)' : null;
  }

  arrowHead(x1: number, y1: number, x2: number, y2: number): string {
    const length = 12;
    const width = 5;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const p1x = x2 - length * Math.cos(angle) + width * Math.sin(angle);
    const p1y = y2 - length * Math.sin(angle) - width * Math.cos(angle);
    const p2x = x2 - length * Math.cos(angle) - width * Math.sin(angle);
    const p2y = y2 - length * Math.sin(angle) + width * Math.cos(angle);
    return `M ${x2} ${y2} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`;
  }

  private edgeModeFor(ann: Annotation): EdgeMode {
    return ann.edgeMode ?? (ann.type === 'arrow' ? 'end' : 'none');
  }
}
