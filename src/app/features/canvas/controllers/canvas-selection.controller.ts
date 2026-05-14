import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CanvasSelectionController {
  readonly selectedAnnotationId = signal<string | null>(null);
  readonly selectedAnnotationIds = signal<string[]>([]);
  readonly selectedEdgeId = signal<string | null>(null);

  clearCanvasSelection(): void {
    this.selectedAnnotationId.set(null);
    this.selectedAnnotationIds.set([]);
    this.selectedEdgeId.set(null);
  }
}
