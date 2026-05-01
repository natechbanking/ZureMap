import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MultiSelectContextMenuComponent } from './multi-select-context-menu.component';

describe('MultiSelectContextMenuComponent', () => {
  let fixture: ComponentFixture<MultiSelectContextMenuComponent>;
  let component: MultiSelectContextMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiSelectContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiSelectContextMenuComponent);
    component = fixture.componentInstance;
    component.count = 2;
    component.x = 10;
    component.y = 20;
  });

  it('emits copyObjects and pasteObjects and closes', () => {
    const copySpy = jasmine.createSpy('copyObjects');
    const pasteSpy = jasmine.createSpy('pasteObjects');
    const closeSpy = jasmine.createSpy('closed');
    component.copyObjects.subscribe(copySpy);
    component.pasteObjects.subscribe(pasteSpy);
    component.closed.subscribe(closeSpy);
    component.canPaste = true;
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    buttons[1].click();

    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(pasteSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('disables paste button when canPaste is false', () => {
    component.canPaste = false;
    fixture.detectChanges();
    const pasteButton = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(pasteButton.disabled).toBeTrue();
  });
});
