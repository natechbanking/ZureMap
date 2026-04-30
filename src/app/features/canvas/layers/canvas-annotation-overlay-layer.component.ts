import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Annotation } from '../../../core/models/annotation.model';
import {
  annotationTextWidth,
  annotationTextHeight,
  annotationTransform,
} from '../canvas-geometry.util';

@Component({
  selector: 'app-canvas-annotation-overlay-layer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-annotation-overlay-layer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasAnnotationOverlayLayerComponent {
  @Input() annotations: Annotation[] = [];
  @Input() selectedAnnotationId: string | null = null;
  @Input() selectedAnnotationIds: string[] = [];
  @Input() editingAnnotation: Annotation | null = null;
  @Input() activeTool = 'pointer';

  @Output() annotationMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() annotationContextMenu = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() imageResizeMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() annotationShapeResizeMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation; handle: string }>();
  @Output() annotationRotateMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() startEdit = new EventEmitter<Annotation>();

  readonly annotationTextWidth = annotationTextWidth;
  readonly annotationTextHeight = annotationTextHeight;
  readonly annotationTransform = annotationTransform;

  isAnnotationSelected(id: string): boolean {
    return this.selectedAnnotationIds.includes(id);
  }
}
