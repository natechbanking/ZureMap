import { Injectable, inject } from '@angular/core';
import { DiagramStore } from '../../../core/store/diagram.store';
import { CanvasControllerContext } from './canvas-controller-context';

@Injectable({ providedIn: 'root' })
export class CanvasControllerContextService implements CanvasControllerContext {
  readonly store = inject(DiagramStore);
}
