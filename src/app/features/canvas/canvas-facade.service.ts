import { Injectable, inject } from '@angular/core';
import { CanvasAnnotationController } from './controllers/canvas-annotation.controller';
import { CanvasClipboardController } from './controllers/canvas-clipboard.controller';
import { CanvasSelectionController } from './controllers/canvas-selection.controller';
import { CanvasViewportController } from './controllers/canvas-viewport.controller';

@Injectable({ providedIn: 'root' })
export class CanvasFacade {
  readonly viewport = inject(CanvasViewportController);
  readonly selection = inject(CanvasSelectionController);
  readonly clipboard = inject(CanvasClipboardController);
  readonly annotation = inject(CanvasAnnotationController);
}
