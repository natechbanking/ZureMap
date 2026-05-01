import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconRegistryService } from '../../../core/services/icon-registry.service';
import { AzureIconComponent } from './azure-icon.component';

describe('AzureIconComponent', () => {
  let fixture: ComponentFixture<AzureIconComponent>;
  let component: AzureIconComponent;
  const iconRegistryStub = {
    getIconUrl: jasmine.createSpy('getIconUrl').and.returnValue('icons/compute/vm.svg'),
    fallbackIcon: 'fallback.svg',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AzureIconComponent],
      providers: [{ provide: IconRegistryService, useValue: iconRegistryStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(AzureIconComponent);
    component = fixture.componentInstance;
    component.resourceType = 'Microsoft.Compute/virtualMachines';
    component.size = 40;
  });

  it('resolves icon URL from registry and renders size/alt', () => {
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(iconRegistryStub.getIconUrl).toHaveBeenCalledWith('Microsoft.Compute/virtualMachines');
    expect(component.resolvedUrl).toBe('icons/compute/vm.svg');
    expect(image.alt).toBe('Microsoft.Compute/virtualMachines');
    expect(image.style.width).toBe('40px');
    expect(image.style.height).toBe('40px');
  });

  it('switches to fallback icon on image error', () => {
    const image = document.createElement('img');
    image.src = 'broken.svg';

    component.onError({ target: image } as unknown as Event);

    expect(image.src).toContain('fallback.svg');
  });
});
