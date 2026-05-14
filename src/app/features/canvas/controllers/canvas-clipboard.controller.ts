import { Injectable, inject } from '@angular/core';
import { Annotation } from '../../../core/models/annotation.model';
import { DiagramEdge } from '../../../core/models/diagram-edge.model';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import { CanvasControllerContextService } from './canvas-controller-context.service';

const CANVAS_COPY_OFFSET = 24;

interface NodeClipboardPayload {
  kind: 'node-set';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface AnnotationClipboardPayload {
  kind: 'annotation-set';
  annotations: Annotation[];
}

type CanvasClipboardPayload = NodeClipboardPayload | AnnotationClipboardPayload;

interface CopyContext {
  annotationContextMenuId: string | null;
  contextMenuNodeId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  closeContextMenu: () => void;
  selectContextNode: (nodeId: string) => void;
  clearAnnotationSelection: () => void;
  annotationById: (id: string) => Annotation | undefined;
}

interface PasteContext {
  selectAnnotations: (ids: string[]) => void;
  clearEdgeSelection: () => void;
  clearAnnotationsSelection: () => void;
  syncToolbarFromAnnotation: (annotation: Annotation) => void;
  closeContextMenu: () => void;
}

@Injectable({ providedIn: 'root' })
export class CanvasClipboardController {
  private readonly context = inject(CanvasControllerContextService);
  private canvasClipboard: CanvasClipboardPayload | null = null;
  private pasteSequence = 0;

  get canPasteAnyObject(): boolean {
    return this.canvasClipboard !== null;
  }

  get canPasteNodeObjects(): boolean {
    return this.canvasClipboard?.kind === 'node-set';
  }

  copySelectedCanvasObject(copyContext: CopyContext): boolean {
    if (copyContext.annotationContextMenuId) {
      const ann = copyContext.annotationById(copyContext.annotationContextMenuId);
      if (!ann) return false;
      this.canvasClipboard = { kind: 'annotation-set', annotations: [this.cloneAnnotation(ann)] };
      this.pasteSequence = 0;
      copyContext.closeContextMenu();
      return true;
    }

    if (copyContext.contextMenuNodeId) {
      copyContext.selectContextNode(copyContext.contextMenuNodeId);
      copyContext.clearAnnotationSelection();
    }

    const selectedAnnotationIds = copyContext.selectedAnnotationIds.length
      ? copyContext.selectedAnnotationIds
      : (copyContext.selectedAnnotationId ? [copyContext.selectedAnnotationId] : []);
    if (selectedAnnotationIds.length > 0) {
      const selectedIdSet = new Set(selectedAnnotationIds);
      const annotations = this.context.store.annotations()
        .filter(a => selectedIdSet.has(a.id))
        .map(a => this.cloneAnnotation(a));
      if (annotations.length === 0) return false;
      this.canvasClipboard = { kind: 'annotation-set', annotations };
      this.pasteSequence = 0;
      copyContext.closeContextMenu();
      return true;
    }

    const selectedNodeIds = this.context.store.selectedNodeIds();
    if (selectedNodeIds.length === 0) return false;
    const nodeIdSet = new Set(selectedNodeIds);
    const nodes = this.context.store.nodes()
      .filter(n => nodeIdSet.has(n.id))
      .map(n => this.cloneNode(n));
    const edges = this.context.store.edges()
      .filter(e => nodeIdSet.has(e.sourceId) && nodeIdSet.has(e.targetId))
      .map(e => this.cloneEdge(e));
    this.canvasClipboard = { kind: 'node-set', nodes, edges };
    this.pasteSequence = 0;
    copyContext.closeContextMenu();
    return true;
  }

  pasteCanvasClipboard(pasteContext: PasteContext): boolean {
    if (!this.canvasClipboard) return false;

    if (this.canvasClipboard.kind === 'annotation-set') {
      const pasted = this.pasteAnnotationsFromClipboard(this.canvasClipboard.annotations);
      if (pasted[0]) {
        pasteContext.selectAnnotations(pasted.map(a => a.id));
        pasteContext.clearEdgeSelection();
        pasteContext.syncToolbarFromAnnotation(pasted[0]);
      }
      pasteContext.closeContextMenu();
      return pasted.length > 0;
    }

    const pastedNodes = this.pasteNodesFromClipboard(this.canvasClipboard.nodes, this.canvasClipboard.edges);
    if (pastedNodes.length > 0) {
      pasteContext.clearAnnotationsSelection();
      pasteContext.clearEdgeSelection();
    }
    pasteContext.closeContextMenu();
    return pastedNodes.length > 0;
  }

  private pasteOffset(): { x: number; y: number } {
    this.pasteSequence += 1;
    const delta = this.pasteSequence * CANVAS_COPY_OFFSET;
    return { x: delta, y: delta };
  }

  private nextNodeId(): string {
    return `copy-node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private nextEdgeId(): string {
    return `copy-edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private nextAnnotationId(): string {
    return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private pasteAnnotationsFromClipboard(sourceAnnotations: Annotation[]): Annotation[] {
    const offset = this.pasteOffset();
    const pasted = sourceAnnotations.map(source => ({
      ...source,
      id: this.nextAnnotationId(),
      x: source.x + offset.x,
      y: source.y + offset.y,
      x2: typeof source.x2 === 'number' ? source.x2 + offset.x : source.x2,
      y2: typeof source.y2 === 'number' ? source.y2 + offset.y : source.y2,
      waypoints: source.waypoints?.map(w => ({ x: w.x + offset.x, y: w.y + offset.y })),
    }));
    if (pasted.length === 0) return [];
    this.context.store.pushUndo();
    this.context.store.setAnnotations([...this.context.store.annotations(), ...pasted]);
    this.context.store.selectNodes([]);
    return pasted;
  }

  private pasteNodesFromClipboard(sourceNodes: DiagramNode[], sourceEdges: DiagramEdge[]): DiagramNode[] {
    const offset = this.pasteOffset();
    const nodeIdMap = new Map<string, string>();
    for (const node of sourceNodes) nodeIdMap.set(node.id, this.nextNodeId());

    const pastedNodes = sourceNodes.map(source => {
      const newId = nodeIdMap.get(source.id)!;
      const remappedParentId = source.parentId ? nodeIdMap.get(source.parentId) : undefined;
      const remappedChildren = source.children
        ?.map(childId => nodeIdMap.get(childId))
        .filter((childId): childId is string => !!childId);
      const groupId = nodeIdMap.get(source.groupId) ?? source.groupId;
      return {
        ...source,
        id: newId,
        parentId: remappedParentId,
        children: remappedChildren,
        groupId,
        selected: false,
        highlighted: false,
        position: { x: source.position.x + offset.x, y: source.position.y + offset.y },
        metadata: {
          ...source.metadata,
          tags: source.metadata?.tags ? { ...source.metadata.tags } : {},
          properties: source.metadata?.properties ? { ...source.metadata.properties } : {},
        },
        custom: source.custom ? {
          ...source.custom,
          internalItems: source.custom.internalItems?.map(i => ({ ...i })),
        } : undefined,
      } as DiagramNode;
    });

    const pastedEdges = sourceEdges
      .map(source => {
        const mappedSourceId = nodeIdMap.get(source.sourceId);
        const mappedTargetId = nodeIdMap.get(source.targetId);
        if (!mappedSourceId || !mappedTargetId) return null;
        return {
          ...source,
          id: this.nextEdgeId(),
          sourceId: mappedSourceId,
          targetId: mappedTargetId,
          style: { ...source.style },
          waypoints: source.waypoints?.map(w => ({ x: w.x + offset.x, y: w.y + offset.y })),
        } as DiagramEdge;
      })
      .filter((edge): edge is DiagramEdge => edge !== null);

    if (pastedNodes.length === 0) return [];
    this.context.store.pushUndo();
    this.context.store.setNodes([...this.context.store.nodes(), ...pastedNodes]);
    this.context.store.setEdges([...this.context.store.edges(), ...pastedEdges]);
    this.context.store.selectNodes(pastedNodes.map(n => n.id));
    return pastedNodes;
  }

  private cloneAnnotation(annotation: Annotation): Annotation {
    return {
      ...annotation,
      waypoints: annotation.waypoints?.map(w => ({ ...w })),
    };
  }

  private cloneEdge(edge: DiagramEdge): DiagramEdge {
    return {
      ...edge,
      style: { ...edge.style },
      waypoints: edge.waypoints ? edge.waypoints.map(w => ({ ...w })) : undefined,
    };
  }

  private cloneNode(node: DiagramNode): DiagramNode {
    return {
      ...node,
      position: { ...node.position },
      size: { ...node.size },
      children: node.children ? [...node.children] : undefined,
      metadata: {
        ...node.metadata,
        tags: node.metadata?.tags ? { ...node.metadata.tags } : {},
        properties: node.metadata?.properties ? { ...node.metadata.properties } : {},
      },
      custom: node.custom ? {
        ...node.custom,
        internalItems: node.custom.internalItems?.map(i => ({ ...i })),
      } : undefined,
    };
  }
}
