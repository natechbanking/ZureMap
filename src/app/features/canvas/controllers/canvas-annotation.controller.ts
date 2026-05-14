import { Injectable, inject } from '@angular/core';
import { Annotation } from '../../../core/models/annotation.model';
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
}
