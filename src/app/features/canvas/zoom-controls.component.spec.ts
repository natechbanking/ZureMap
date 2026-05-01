import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZoomControlsComponent } from './zoom-controls.component';

describe('ZoomControlsComponent', () => {
  let fixture: ComponentFixture<ZoomControlsComponent>;
  let component: ZoomControlsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoomControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ZoomControlsComponent);
    component = fixture.componentInstance;
    component.zoomPercent = 125;
    component.right = 12;
    component.minimapOpen = false;
  });

  it('emits zoom and minimap events from buttons', () => {
    const zoomInSpy = jasmine.createSpy('zoomIn');
    const zoomOutSpy = jasmine.createSpy('zoomOut');
    const resetSpy = jasmine.createSpy('resetZoom');
    const toggleSpy = jasmine.createSpy('toggleMinimap');
    component.zoomIn.subscribe(zoomInSpy);
    component.zoomOut.subscribe(zoomOutSpy);
    component.resetZoom.subscribe(resetSpy);
    component.toggleMinimap.subscribe(toggleSpy);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    buttons[3].click();

    expect(zoomOutSpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(zoomInSpy).toHaveBeenCalledTimes(1);
    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  it('shows hide minimap title and active style when minimap is open', () => {
    component.minimapOpen = true;
    fixture.detectChanges();

    const toggleButton = fixture.nativeElement.querySelectorAll('button')[3] as HTMLButtonElement;
    expect(toggleButton.title).toBe('Hide minimap');
    expect(toggleButton.classList.contains('bg-blue-500')).toBeTrue();
  });
});
