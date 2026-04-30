import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Annotation } from '../../core/models/annotation.model';

@Component({
  selector: 'app-annotation-edit-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showDeleteButton) {
      <button
        class="absolute z-50 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow hover:bg-red-600 transition-colors"
        [style.left.px]="deleteX"
        [style.top.px]="deleteY"
        (mousedown)="$event.stopPropagation()"
        (click)="deleteSelected.emit()"
        title="Delete annotation (Del)"
      >✕</button>
    }

    @if (editingAnnotation) {
      <textarea
        #editTextarea
        class="absolute z-50 resize p-1.5 rounded border-2 border-blue-400 shadow-lg outline-none text-sm"
        [class.bg-transparent]="editingAnnotation.type === 'text'"
        [class.bg-yellow-100]="editingAnnotation.type === 'sticky'"
        [style.left.px]="editingAnnotation.x"
        [style.top.px]="editingAnnotation.y"
        [style.min-width.px]="160"
        [style.min-height.px]="editingAnnotation.type === 'sticky' ? 80 : 36"
        [style.font-size.px]="editingAnnotation.fontSize ?? 14"
        [style.font-family]="editingAnnotation.fontFamily ?? 'Arial, sans-serif'"
        [style.color]="editingAnnotation.color"
        [value]="editingText"
        placeholder="Type here…"
        (input)="editingTextChange.emit(textValue($event))"
        (blur)="onBlur($event)"
        (keydown)="editKeyDown.emit($event)"
        (mousedown)="$event.stopPropagation()"
      ></textarea>
    }
  `,
})
export class AnnotationEditOverlayComponent implements AfterViewInit, OnChanges {
  @ViewChild('editTextarea') editTextareaRef?: ElementRef<HTMLTextAreaElement>;

  @Input() showDeleteButton = false;
  @Input() deleteX = 0;
  @Input() deleteY = 0;
  @Input() editingAnnotation: Annotation | null = null;
  @Input() editingText = '';

  @Output() deleteSelected = new EventEmitter<void>();
  @Output() editingTextChange = new EventEmitter<string>();
  @Output() finishEdit = new EventEmitter<string>();
  @Output() editKeyDown = new EventEmitter<KeyboardEvent>();

  ngAfterViewInit(): void {
    this.focusTextarea();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingAnnotation'] && this.editingAnnotation) {
      this.focusTextarea();
    }
  }

  textValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value ?? '';
  }

  onBlur(event: FocusEvent): void {
    const value = this.textValue(event);
    this.editingTextChange.emit(value);
    this.finishEdit.emit(value);
  }

  private focusTextarea(): void {
    queueMicrotask(() => this.editTextareaRef?.nativeElement?.focus());
  }
}
