import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiagramStore } from '../../core/store/diagram.store';
import { IconRegistryService } from '../../core/services/icon-registry.service';
import { makeDiagramNode, makeSubscription } from '../../testing/test-helpers';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  const selectedNode = makeDiagramNode({
    id: '/subscriptions/sub-1/resourceGroups/rg-a/providers/Microsoft.Compute/virtualMachines/vm-a',
    label: 'vm-a',
    resourceType: 'microsoft.compute/virtualmachines',
    status: 'running',
    metadata: {
      ...makeDiagramNode().metadata,
      subscriptionId: 'sub-1',
      tags: { env: 'prod' },
    },
    costData: { monthlyCostUsd: 99.5, currency: 'USD', period: 'last30', isEstimate: false },
  });
  const storeStub = {
    selectedNode: jasmine.createSpy('selectedNode').and.returnValue(selectedNode),
    selectNode: jasmine.createSpy('selectNode'),
    activeSubscriptions: jasmine.createSpy('activeSubscriptions').and.returnValue([makeSubscription({ subscriptionId: 'sub-1', name: 'Primary Sub' })]),
    availableSubscriptions: jasmine.createSpy('availableSubscriptions').and.returnValue([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        { provide: DiagramStore, useValue: storeStub },
        {
          provide: IconRegistryService,
          useValue: {
            getIconUrl: () => 'icons/vm.svg',
            getTypeLabel: () => 'Virtual Machine',
            fallbackIcon: 'fallback.svg',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
  });

  it('renders selected node details and resolves subscription display name', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('vm-a');
    expect(text).toContain('Primary Sub');
    expect(text).toContain('env: prod');
  });

  it('clears selected node when close button is clicked', () => {
    const closeButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    closeButton.click();
    expect(storeStub.selectNode).toHaveBeenCalledWith(null);
  });

  it('builds portal URL and copies ARM id', async () => {
    const component = fixture.componentInstance;
    const clipboardSpy = spyOn(navigator.clipboard, 'writeText').and.resolveTo();

    expect(component.portalUrl('/subscriptions/sub-1/resourceGroups/rg-a/providers/Microsoft.Compute/virtualMachines/vm-a'))
      .toBe('https://portal.azure.com/#resource/subscriptions/sub-1/resourceGroups/rg-a/providers/Microsoft.Compute/virtualMachines/vm-a/overview');

    component.copyArmId('abc');
    expect(clipboardSpy).toHaveBeenCalledWith('abc');
  });
});
