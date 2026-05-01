import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeDiagramEdge } from '../../testing/test-helpers';
import { EdgeStylePanelComponent } from './edge-style-panel.component';

describe('EdgeStylePanelComponent', () => {
  let fixture: ComponentFixture<EdgeStylePanelComponent>;
  let component: EdgeStylePanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EdgeStylePanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EdgeStylePanelComponent);
    component = fixture.componentInstance;
    component.edge = makeDiagramEdge({
      style: { strokeColor: '#0078d4', strokeWidth: 2, markerEnd: 'arrow' },
      animated: false,
    });
    component.right = 24;
    component.dashStyle = 'solid';
    fixture.detectChanges();
  });

  it('emits style changes from controls', () => {
    const strokeColorSpy = jasmine.createSpy('strokeColorChange');
    const strokeWidthSpy = jasmine.createSpy('strokeWidthChange');
    const markerSpy = jasmine.createSpy('markerChange');
    const dashSpy = jasmine.createSpy('dashStyleChange');
    const animatedSpy = jasmine.createSpy('animatedChange');
    const resetSpy = jasmine.createSpy('styleReset');
    component.strokeColorChange.subscribe(strokeColorSpy);
    component.strokeWidthChange.subscribe(strokeWidthSpy);
    component.markerChange.subscribe(markerSpy);
    component.dashStyleChange.subscribe(dashSpy);
    component.animatedChange.subscribe(animatedSpy);
    component.styleReset.subscribe(resetSpy);

    const colorInput = fixture.nativeElement.querySelector('input[type="color"]') as HTMLInputElement;
    colorInput.value = '#111111';
    colorInput.dispatchEvent(new Event('input'));

    const selects = fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
    selects[0].value = '3';
    selects[0].dispatchEvent(new Event('change'));
    selects[1].value = 'dotted';
    selects[1].dispatchEvent(new Event('change'));
    selects[2].value = 'none';
    selects[2].dispatchEvent(new Event('change'));

    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const resetButton = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    resetButton.click();

    expect(strokeColorSpy).toHaveBeenCalledWith('#111111');
    expect(strokeWidthSpy).toHaveBeenCalledWith(3);
    expect(dashSpy).toHaveBeenCalledWith('dotted');
    expect(markerSpy).toHaveBeenCalledWith('none');
    expect(animatedSpy).toHaveBeenCalledWith(true);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('emits deleteRequested for Delete key outside editable targets', () => {
    const deleteSpy = jasmine.createSpy('deleteRequested');
    component.deleteRequested.subscribe(deleteSpy);
    const preventDefault = jasmine.createSpy('preventDefault');

    component.onKeyDown({
      key: 'Delete',
      preventDefault,
      target: document.createElement('div'),
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores delete shortcut from input target', () => {
    const deleteSpy = jasmine.createSpy('deleteRequested');
    component.deleteRequested.subscribe(deleteSpy);
    const preventDefault = jasmine.createSpy('preventDefault');
    const input = document.createElement('input');

    component.onKeyDown({
      key: 'Backspace',
      preventDefault,
      target: input,
    } as unknown as KeyboardEvent);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
