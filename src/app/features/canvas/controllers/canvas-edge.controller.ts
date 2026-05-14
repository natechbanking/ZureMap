import { Injectable, inject } from '@angular/core';
import { DiagramEdge, EdgeStyle } from '../../../core/models/diagram-edge.model';
import { CanvasEdgeEditorService } from '../canvas-edge-editor.service';
import { CanvasControllerContextService } from './canvas-controller-context.service';

@Injectable({ providedIn: 'root' })
export class CanvasEdgeController {
  private readonly store = inject(CanvasControllerContextService).store;
  private readonly edgeEditor = inject(CanvasEdgeEditorService);

  getSelectedEdge(selectedEdgeId: string | null): DiagramEdge | null {
    return this.edgeEditor.getSelectedEdge(this.store.edges(), selectedEdgeId);
  }

  onEdgeClick(event: MouseEvent, edge: DiagramEdge, activeTool: string): string | null {
    if (activeTool !== 'pointer') return null;
    event.stopPropagation();
    return edge.id;
  }

  onEdgeWaypointMouseDown(
    event: MouseEvent,
    edge: DiagramEdge,
    waypointIndex: number,
    svgPoint: (event: MouseEvent) => { x: number; y: number },
  ): { edgeId: string; waypointIndex: number; lastX: number; lastY: number } {
    event.stopPropagation();
    event.preventDefault();
    this.store.pushUndo();
    const pt = svgPoint(event);
    return { edgeId: edge.id, waypointIndex, lastX: pt.x, lastY: pt.y };
  }

  onEdgeMidpointMouseDown(
    event: MouseEvent,
    edge: DiagramEdge,
    segmentIndex: number,
    svgPoint: (event: MouseEvent) => { x: number; y: number },
  ): { edgeId: string; waypointIndex: number; lastX: number; lastY: number } {
    event.stopPropagation();
    event.preventDefault();
    this.store.pushUndo();
    const pt = svgPoint(event);
    const waypoints = [...(edge.waypoints ?? [])];
    waypoints.splice(segmentIndex, 0, { x: pt.x, y: pt.y });
    this.store.setEdges(this.store.edges().map(ed => ed.id === edge.id ? { ...ed, waypoints } : ed));
    return { edgeId: edge.id, waypointIndex: segmentIndex, lastX: pt.x, lastY: pt.y };
  }

  onEdgeWaypointDblClick(event: MouseEvent, edge: DiagramEdge, waypointIndex: number): void {
    event.stopPropagation();
    this.store.pushUndo();
    const waypoints = (edge.waypoints ?? []).filter((_, i) => i !== waypointIndex);
    this.store.setEdges(this.store.edges().map(ed => ed.id === edge.id ? { ...ed, waypoints: waypoints.length ? waypoints : undefined } : ed));
  }

  updateSelectedEdgeStyle(selectedEdgeId: string | null, changes: Partial<EdgeStyle>): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.updateEdgeStyle(this.store.edges(), selectedEdgeId, changes));
  }

  setSelectedEdgeDashStyle(selectedEdgeId: string | null, style: string): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setDashStyle(this.store.edges(), selectedEdgeId, style));
  }

  setSelectedEdgeMarker(selectedEdgeId: string | null, value: string): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setMarker(this.store.edges(), selectedEdgeId, value));
  }

  setSelectedEdgeAnimated(selectedEdgeId: string | null, animated: boolean): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setAnimated(this.store.edges(), selectedEdgeId, animated));
  }

  resetSelectedEdgeStyle(selectedEdgeId: string | null): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.resetStyle(this.store.edges(), selectedEdgeId));
  }

  setSelectedEdgeLabel(selectedEdgeId: string | null, label: string): void {
    this.store.pushUndo();
    this.store.setEdges(this.edgeEditor.setLabel(this.store.edges(), selectedEdgeId, label));
  }

  dashStyleValue(style: EdgeStyle): string {
    return this.edgeEditor.dashStyleValue(style);
  }
}
