import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeSubscription } from '../../../testing/test-helpers';
import { SubscriptionSelectorComponent } from './subscription-selector.component';

describe('SubscriptionSelectorComponent', () => {
  let fixture: ComponentFixture<SubscriptionSelectorComponent>;
  let component: SubscriptionSelectorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionSelectorComponent);
    component = fixture.componentInstance;
    component.subscriptions = [
      makeSubscription({ subscriptionId: 'sub-1', name: 'App Prod', tenantId: 'tenant-a', tenantName: 'Tenant A' }),
      makeSubscription({ subscriptionId: 'sub-2', name: 'Data Prod', tenantId: 'tenant-a', tenantName: 'Tenant A' }),
      makeSubscription({ subscriptionId: 'sub-3', name: 'Dev', tenantId: 'tenant-b', tenantName: 'Tenant B', state: 'Disabled' }),
    ];
    fixture.detectChanges();
  });

  it('filters and groups subscriptions by tenant', () => {
    component.searchQuery = 'prod';
    const groups = component.groupedSubscriptions;

    expect(groups.length).toBe(1);
    expect(groups[0].tenantId).toBe('tenant-a');
    expect(groups[0].subscriptions.length).toBe(2);
  });

  it('toggles single subscription selection', () => {
    const sub = component.subscriptions[0];
    expect(component.isSelected(sub)).toBeFalse();

    component.toggle(sub);
    expect(component.isSelected(sub)).toBeTrue();

    component.toggle(sub);
    expect(component.isSelected(sub)).toBeFalse();
  });

  it('selects and deselects all subscriptions for a tenant', () => {
    component.toggleTenant('tenant-a');
    expect(component.selected.length).toBe(2);
    expect(component.areAllTenantSubsSelected('tenant-a')).toBeTrue();

    component.toggleTenant('tenant-a');
    expect(component.selected.length).toBe(0);
    expect(component.areAllTenantSubsSelected('tenant-a')).toBeFalse();
  });

  it('emits confirmed only when at least one subscription is selected', () => {
    const confirmedSpy = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(confirmedSpy);

    component.confirm();
    expect(confirmedSpy).not.toHaveBeenCalled();

    component.toggle(component.subscriptions[2]);
    component.confirm();
    expect(confirmedSpy).toHaveBeenCalledTimes(1);
    expect(confirmedSpy).toHaveBeenCalledWith([component.subscriptions[2]]);
  });
});
