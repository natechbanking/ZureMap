import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToolbarComponent } from './toolbar.component';

describe('ToolbarComponent', () => {
  let fixture: ComponentFixture<ToolbarComponent>;
  let component: ToolbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    component.nodeCount = 10;
    component.edgeCount = 5;
    component.totalCost = 2500;
    component.totalCostCurrency = 'USD';
    fixture.detectChanges();
  });

  it('emits importJson and resets file input after file selection', () => {
    const importSpy = jasmine.createSpy('importJson');
    component.importJson.subscribe(importSpy);
    const file = new File(['{}'], 'diagram.json', { type: 'application/json' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    input.value = 'C:\\fakepath\\diagram.json';

    component.onFileChange({ target: input } as unknown as Event);

    expect(importSpy).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it('emits top-level actions from buttons', () => {
    const toggleFinOpsSpy = jasmine.createSpy('toggleFinOps');
    const exportJsonSpy = jasmine.createSpy('exportJson');
    const exportDialogSpy = jasmine.createSpy('openExportDialog');
    const rescanSpy = jasmine.createSpy('rescan');
    const relayoutSpy = jasmine.createSpy('relayout');
    component.toggleFinOps.subscribe(toggleFinOpsSpy);
    component.exportJson.subscribe(exportJsonSpy);
    component.openExportDialog.subscribe(exportDialogSpy);
    component.rescan.subscribe(rescanSpy);
    component.relayout.subscribe(relayoutSpy);

    const menuButton = fixture.nativeElement.querySelector('button[aria-label="Open menu"]') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click(); // FinOps
    menuButton.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('button')[2].click(); // JSON
    menuButton.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('button')[3].click(); // Export
    menuButton.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('button')[4].click(); // Rescan
    menuButton.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('button')[5].click(); // Auto-layout

    expect(toggleFinOpsSpy).toHaveBeenCalledTimes(1);
    expect(exportJsonSpy).toHaveBeenCalledTimes(1);
    expect(exportDialogSpy).toHaveBeenCalledTimes(1);
    expect(rescanSpy).toHaveBeenCalledTimes(1);
    expect(relayoutSpy).toHaveBeenCalledTimes(1);
  });

  it('does not render dropdown actions while menu is closed', () => {
    const finOpsButton = fixture.nativeElement.querySelector('button[title="Open/close FinOps drawer"]');
    expect(finOpsButton).toBeNull();
  });

  it('renders dropdown actions when menu is open', () => {
    const menuButton = fixture.nativeElement.querySelector('button[aria-label="Open menu"]') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    const finOpsButton = fixture.nativeElement.querySelector('button[title="Open/close FinOps drawer"]');
    expect(finOpsButton).not.toBeNull();
  });
});
