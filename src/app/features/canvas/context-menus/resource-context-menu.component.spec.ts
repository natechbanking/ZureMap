import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeDiagramNode } from '../../../testing/test-helpers';
import { ResourceContextMenuComponent } from './resource-context-menu.component';

describe('ResourceContextMenuComponent', () => {
  let fixture: ComponentFixture<ResourceContextMenuComponent>;
  let component: ResourceContextMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourceContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ResourceContextMenuComponent);
    component = fixture.componentInstance;
    component.node = makeDiagramNode();
    component.x = 10;
    component.y = 20;
  });

  it('emits copyObject and pasteObject from menu buttons', () => {
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

  it('disables paste button when canPaste is false', () => {
    component.canPaste = false;
    fixture.detectChanges();

    const pasteButton = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(pasteButton.disabled).toBeTrue();
  });
});
