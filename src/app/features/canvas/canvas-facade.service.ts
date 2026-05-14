import { Injectable, inject } from '@angular/core';
import { CanvasSelectionController } from './controllers/canvas-selection.controller';
import { CanvasViewportController } from './controllers/canvas-viewport.controller';

@Injectable({ providedIn: 'root' })
export class CanvasFacade {
  readonly viewport = inject(CanvasViewportController);
  readonly selection = inject(CanvasSelectionController);
}
