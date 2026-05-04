import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Annotation, DrawingTool } from '../../../core/models/annotation.model';
import {
  annotationTextWidth,
  annotationTextHeight,
  annotationTransform,
  annotationBoundingBox,
  CONNECTABLE_ANNOTATION_TYPES,
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
  @Input() editingAnnotation: Annotation | null = null;
  @Input() activeTool: DrawingTool = 'pointer';
  @Input() isLinking = false;

  private _selectedAnnotationIdSet = new Set<string>();

  @Input() set selectedAnnotationIds(ids: string[]) {
    this._selectedAnnotationIdSet = new Set(ids);
  }

  get selectedAnnotationIds(): string[] {
    return [...this._selectedAnnotationIdSet];
  }

  @Output() annotationMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() annotationContextMenu = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() imageResizeMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() annotationShapeResizeMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation; handle: string }>();
  @Output() annotationRotateMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation }>();
  @Output() startEdit = new EventEmitter<Annotation>();
  @Output() annPortMouseDown = new EventEmitter<{ event: MouseEvent; ann: Annotation; portId: string }>();

  readonly annotationTextWidth = annotationTextWidth;
  readonly annotationTextHeight = annotationTextHeight;
  readonly annotationTransform = annotationTransform;
  readonly annotationBoundingBox = annotationBoundingBox;
  readonly CONNECTABLE_ANNOTATION_TYPES = CONNECTABLE_ANNOTATION_TYPES;

  onAnnPortMouseDown(event: MouseEvent, ann: Annotation, portId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.annPortMouseDown.emit({ event, ann, portId });
  }

  isAnnotationSelected(id: string): boolean {
    return this._selectedAnnotationIdSet.has(id);
  }
}
