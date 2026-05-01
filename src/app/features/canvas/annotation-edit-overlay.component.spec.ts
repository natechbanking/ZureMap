import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeAnnotation } from '../../testing/test-helpers';
import { AnnotationEditOverlayComponent } from './annotation-edit-overlay.component';

describe('AnnotationEditOverlayComponent', () => {
  let fixture: ComponentFixture<AnnotationEditOverlayComponent>;
  let component: AnnotationEditOverlayComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationEditOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationEditOverlayComponent);
    component = fixture.componentInstance;
  });

  it('emits deleteSelected when delete button is clicked', () => {
    const deleteSpy = jasmine.createSpy('deleteSelected');
    component.deleteSelected.subscribe(deleteSpy);
    component.showDeleteButton = true;
    component.deleteX = 20;
    component.deleteY = 30;
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('emits text changes and finishEdit on blur', () => {
    const textChangeSpy = jasmine.createSpy('editingTextChange');
    const finishSpy = jasmine.createSpy('finishEdit');
    component.editingTextChange.subscribe(textChangeSpy);
    component.finishEdit.subscribe(finishSpy);
    component.editingAnnotation = makeAnnotation({
      type: 'text',
      width: 180,
      height: 40,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
    });
    component.editingText = 'before';
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'after';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new FocusEvent('blur'));

    expect(textChangeSpy).toHaveBeenCalledWith('after');
    expect(finishSpy).toHaveBeenCalledWith('after');
  });
});
