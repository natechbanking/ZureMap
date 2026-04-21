import { Injectable } from '@angular/core';
import { DiagramEdge, EdgeStyle, EDGE_STYLES } from '../../core/models/diagram-edge.model';

@Injectable({ providedIn: 'root' })
export class CanvasEdgeEditorService {
  getSelectedEdge(edges: DiagramEdge[], selectedEdgeId: string | null): DiagramEdge | null {
    if (!selectedEdgeId) return null;
    return edges.find(e => e.id === selectedEdgeId) ?? null;
  }

  updateEdgeStyle(edges: DiagramEdge[], selectedEdgeId: string | null, changes: Partial<EdgeStyle>): DiagramEdge[] {
    if (!selectedEdgeId) return edges;
    return edges.map(e =>
      e.id === selectedEdgeId ? { ...e, style: { ...e.style, ...changes } } : e
    );
  }

  setDashStyle(edges: DiagramEdge[], selectedEdgeId: string | null, style: string): DiagramEdge[] {
    if (style === 'dashed') return this.updateEdgeStyle(edges, selectedEdgeId, { dashArray: '6 3' });
    if (style === 'dotted') return this.updateEdgeStyle(edges, selectedEdgeId, { dashArray: '2 3' });
    return this.updateEdgeStyle(edges, selectedEdgeId, { dashArray: undefined });
  }

  setMarker(edges: DiagramEdge[], selectedEdgeId: string | null, value: string): DiagramEdge[] {
    return this.updateEdgeStyle(edges, selectedEdgeId, { markerEnd: value === 'none' ? 'none' : 'arrow' });
  }

  setAnimated(edges: DiagramEdge[], selectedEdgeId: string | null, animated: boolean): DiagramEdge[] {
    if (!selectedEdgeId) return edges;
    return edges.map(e => (e.id === selectedEdgeId ? { ...e, animated } : e));
  }

  resetStyle(edges: DiagramEdge[], selectedEdgeId: string | null): DiagramEdge[] {
    const edge = this.getSelectedEdge(edges, selectedEdgeId);
    if (!edge) return edges;
    return edges.map(e =>
      e.id === edge.id ? { ...e, style: { ...EDGE_STYLES[e.edgeType] }, animated: e.edgeType === 'privateLink' } : e
    );
  }

  dashStyleValue(style: EdgeStyle): string {
    if (!style.dashArray) return 'solid';
    if (style.dashArray === '6 3' || style.dashArray === '8 4') return 'dashed';
    return 'dotted';
  }
}
