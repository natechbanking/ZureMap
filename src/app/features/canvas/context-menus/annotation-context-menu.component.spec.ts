import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeAnnotation } from '../../../testing/test-helpers';
import { AnnotationContextMenuComponent } from './annotation-context-menu.component';

describe('AnnotationContextMenuComponent', () => {
  let fixture: ComponentFixture<AnnotationContextMenuComponent>;
  let component: AnnotationContextMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationContextMenuComponent);
    component = fixture.componentInstance;
    component.annotation = makeAnnotation({ type: 'text', text: 'abc' });
    component.x = 1;
    component.y = 2;
  });

  it('emits copyObject and pasteObject', () => {
    const copySpy = jasmine.createSpy('copyObject');
    const pasteSpy = jasmine.createSpy('pasteObject');
    component.copyObject.subscribe(copySpy);
    component.pasteObject.subscribe(pasteSpy);
    component.canPaste = true;
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    buttons[1].click();

    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(pasteSpy).toHaveBeenCalledTimes(1);
  });

  it('shows copy text action only for text/sticky annotations', () => {
    fixture.detectChanges();
    let text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Copy text');

    component.annotation = makeAnnotation({ type: 'rect' });
    fixture.detectChanges();
    text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Copy text');
  });
});
