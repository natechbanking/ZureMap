import { Injectable, inject } from '@angular/core';
import { Annotation } from '../../../core/models/annotation.model';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import { CanvasAnnotationService } from '../canvas-annotation.service';
import { CanvasControllerContextService } from './canvas-controller-context.service';

interface AnnotationSelectionContext {
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  activeTool: 'pointer' | string;
  clearShapeBinding: (annotationId: string) => void;
  syncToolbarFromAnnotation: (annotation: Annotation) => void;
  setSelectedAnnotation: (id: string | null, ids: string[]) => void;
}

interface AnnotationMouseDownContext {
  activeTool: string;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  canvasPointFromClient: (x: number, y: number) => { x: number; y: number };
  nodeAtCanvasPoint: (x: number, y: number) => DiagramNode | null | undefined;
  onNodeMouseDown: (event: MouseEvent, node: DiagramNode) => void;
  closeAnnotationAndResourceMenus: () => void;
  clearEdgeSelection: () => void;
  annotationById: (id: string) => Annotation | undefined;
  syncToolbarFromAnnotation: (annotation: Annotation) => void;
  svgPoint: (event: MouseEvent) => { x: number; y: number };
  setSelection: (id: string | null, ids: string[]) => void;
}

@Injectable({ providedIn: 'root' })
export class CanvasAnnotationController {
  private readonly store = inject(CanvasControllerContextService).store;
  private readonly annotationSvc = inject(CanvasAnnotationService);

  startEditAnnotation(annotation: Annotation): { editingAnnotation: Annotation; editingTextValue: string } {
    return { editingAnnotation: annotation, editingTextValue: annotation.text ?? '' };
  }

  finishEdit(
    editingAnnotation: Annotation | null,
    editingTextValue: string,
    clearShapeBinding: (annotationId: string) => void,
    nextText?: string,
  ): { editingAnnotation: null; editingTextValue: string } | null {
    if (!editingAnnotation) return null;
    const text = (typeof nextText === 'string' ? nextText : editingTextValue).trim();
    this.store.pushUndo();
    if (text) {
      this.store.updateAnnotation(editingAnnotation.id, { text });
    } else {
      clearShapeBinding(editingAnnotation.id);
      this.store.deleteAnnotation(editingAnnotation.id);
    }
    return { editingAnnotation: null, editingTextValue: '' };
  }

  cancelEdit(
    editingAnnotation: Annotation | null,
    clearShapeBinding: (annotationId: string) => void,
  ): { editingAnnotation: null; editingTextValue: string } {
    if (editingAnnotation && !editingAnnotation.text) {
      clearShapeBinding(editingAnnotation.id);
      this.store.deleteAnnotation(editingAnnotation.id);
    }
    return { editingAnnotation: null, editingTextValue: '' };
  }

  deleteSelectedAnnotation(selection: AnnotationSelectionContext): boolean {
    const ids = selection.selectedAnnotationIds.length
      ? selection.selectedAnnotationIds
      : (selection.selectedAnnotationId ? [selection.selectedAnnotationId] : []);
    if (!ids.length) return false;
    this.store.pushUndo();
    const idSet = new Set(ids);
    this.store.setNodes(this.store.nodes().map(n => {
      if (!n.custom?.boundShapeAnnotationId || !idSet.has(n.custom.boundShapeAnnotationId)) return n;
      return { ...n, custom: { ...(n.custom ?? {}), boundShapeAnnotationId: undefined } };
    }));
    this.store.setAnnotations(this.store.annotations().filter(a => !idSet.has(a.id)));
    selection.setSelectedAnnotation(null, []);
    return true;
  }

  duplicateSelectedAnnotation(selection: AnnotationSelectionContext): boolean {
    if (!selection.selectedAnnotationId) return false;
    const source = this.annotationById(selection.selectedAnnotationId);
    if (!source) return false;
    const duplicated = this.annotationSvc.duplicate(source);
    this.store.pushUndo();
    this.store.addAnnotation(duplicated);
    selection.setSelectedAnnotation(duplicated.id, [duplicated.id]);
    selection.syncToolbarFromAnnotation(duplicated);
    return true;
  }

  bringSelectedAnnotationToFront(selection: AnnotationSelectionContext): boolean {
    if (!selection.selectedAnnotationId) return false;
    this.store.pushUndo();
    this.store.setAnnotations(this.annotationSvc.bringToFront(this.store.annotations(), selection.selectedAnnotationId));
    return true;
  }

  sendSelectedAnnotationToBack(selection: AnnotationSelectionContext): boolean {
    if (!selection.selectedAnnotationId) return false;
    this.store.pushUndo();
    this.store.setAnnotations(this.annotationSvc.sendToBack(this.store.annotations(), selection.selectedAnnotationId));
    return true;
  }

  clearAllAnnotations(): boolean {
    if (this.store.annotations().length === 0) return false;
    const shouldClear = confirm('Clear all annotations from this diagram?');
    if (!shouldClear) return false;
    this.store.pushUndo();
    this.store.clearAnnotations();
    return true;
  }

  selectedAnnotationForDelete(
    selectedAnnotationId: string | null,
    activeTool: string,
  ): Annotation | null {
    if (!selectedAnnotationId || activeTool !== 'pointer') return null;
    return this.annotationById(selectedAnnotationId) ?? null;
  }

  canEditSelectedTextStyle(selectedAnnotationId: string | null): boolean {
    if (!selectedAnnotationId) return false;
    const ann = this.annotationById(selectedAnnotationId);
    return ann?.type === 'text' || ann?.type === 'sticky';
  }

  canEditSelectedFillStyle(selectedAnnotationId: string | null): boolean {
    if (!selectedAnnotationId) return false;
    const ann = this.annotationById(selectedAnnotationId);
    return ann?.type === 'rect' || ann?.type === 'ellipse' || ann?.type === 'diamond';
  }

  annotationById(id: string): Annotation | undefined {
    return this.store.annotations().find(a => a.id === id);
  }

  onAnnotationMouseDown(
    event: MouseEvent,
    annotation: Annotation,
    context: AnnotationMouseDownContext,
  ): {
    annDragId: string;
    annDragMouse: { x: number; y: number };
    annDragOrigin: { x: number; y: number; x2?: number; y2?: number };
  } | null {
    if (context.activeTool !== 'pointer') return null;
    if (event.button !== 0) return null;
    const isOpaqueAnnotation =
      annotation.type === 'image' ||
      annotation.type === 'text' ||
      annotation.type === 'sticky' ||
      !!annotation.container;
    if (!isOpaqueAnnotation) {
      const canvasPt = context.canvasPointFromClient(event.clientX, event.clientY);
      const nodeUnder = context.nodeAtCanvasPoint(canvasPt.x, canvasPt.y);
      if (nodeUnder) {
        context.onNodeMouseDown(event, nodeUnder);
        return null;
      }
    }
    event.stopPropagation();
    context.closeAnnotationAndResourceMenus();
    context.clearEdgeSelection();
    if (event.ctrlKey || event.metaKey) {
      const nextIds = context.selectedAnnotationIds.includes(annotation.id)
        ? context.selectedAnnotationIds.filter(id => id !== annotation.id)
        : [...context.selectedAnnotationIds, annotation.id];
      const nextId = nextIds[0] ?? null;
      context.setSelection(nextId, nextIds);
      if (nextId) {
        const selected = context.annotationById(nextId);
        if (selected) context.syncToolbarFromAnnotation(selected);
      }
      return null;
    }
    context.setSelection(annotation.id, [annotation.id]);
    context.syncToolbarFromAnnotation(annotation);
    const pt = context.svgPoint(event);
    this.store.pushUndo();
    return {
      annDragId: annotation.id,
      annDragMouse: { x: pt.x, y: pt.y },
      annDragOrigin: { x: annotation.x, y: annotation.y, x2: annotation.x2, y2: annotation.y2 },
    };
  }

  onImageResizeMouseDown(
    event: MouseEvent,
    annotation: Annotation,
    activeTool: string,
  ): { annId: string; startX: number; startY: number; startWidth: number; startHeight: number; aspect: number } | null {
    if (activeTool !== 'pointer') return null;
    event.preventDefault();
    event.stopPropagation();
    const width = Math.max(1, annotation.width ?? 240);
    const height = Math.max(1, annotation.height ?? 180);
    this.store.pushUndo();
    return {
      annId: annotation.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: width,
      startHeight: height,
      aspect: width / height,
    };
  }

  onAnnotationShapeResizeMouseDown(
    event: MouseEvent,
    annotation: Annotation,
    handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w',
    activeTool: string,
    annotationTextWidth: number,
    annotationTextHeight: number,
  ): {
    annId: string;
    handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null {
    if (activeTool !== 'pointer') return null;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    return {
      annId: annotation.id,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: annotation.x,
      startY: annotation.y,
      startWidth: annotation.width ?? annotationTextWidth,
      startHeight: annotation.height ?? annotationTextHeight,
    };
  }

  onAnnotationRotateMouseDown(
    event: MouseEvent,
    annotation: Annotation,
    activeTool: string,
    annotationTextWidth: number,
    annotationTextHeight: number,
  ): { annId: string; cx: number; cy: number } | null {
    if (activeTool !== 'pointer') return null;
    event.preventDefault();
    event.stopPropagation();
    this.store.pushUndo();
    return {
      annId: annotation.id,
      cx: annotation.x + annotationTextWidth / 2,
      cy: annotation.y + annotationTextHeight / 2,
    };
  }
}
