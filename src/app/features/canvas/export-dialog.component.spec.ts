import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExportDialogComponent } from './export-dialog.component';

describe('ExportDialogComponent', () => {
  let fixture: ComponentFixture<ExportDialogComponent>;
  let component: ExportDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportDialogComponent);
    component = fixture.componentInstance;
    component.bg = 'white';
    component.embed = false;
    component.busy = false;
    fixture.detectChanges();
  });

  it('emits close when backdrop is clicked', () => {
    const closeSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closeSpy);

    const backdrop = fixture.nativeElement.querySelector('div.absolute') as HTMLDivElement;
    backdrop.click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('emits background and embed changes from controls', () => {
    const bgSpy = jasmine.createSpy('bgChange');
    const embedSpy = jasmine.createSpy('embedChange');
    component.bgChange.subscribe(bgSpy);
    component.embedChange.subscribe(embedSpy);

    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
    radios[1].dispatchEvent(new Event('change'));

    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(bgSpy).toHaveBeenCalledWith('black');
    expect(embedSpy).toHaveBeenCalledWith(true);
  });

  it('emits export when export button is clicked', () => {
    const exportSpy = jasmine.createSpy('export');
    component.export.subscribe(exportSpy);

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[2].click();

    expect(exportSpy).toHaveBeenCalledTimes(1);
  });
});
