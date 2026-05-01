import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AzureFirewallDetailsService } from './azure-firewall-details.service';

describe('AzureFirewallDetailsService', () => {
  let service: AzureFirewallDetailsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AzureFirewallDetailsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AzureFirewallDetailsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests firewall policy rule counts', async () => {
    const p = service.getPolicyRuleCounts('fw-1');
    const req = httpMock.expectOne('/api/az/firewall-policy-rule-counts?firewallId=fw-1');
    req.flush({ applicationRules: 1, networkRules: 2, natRules: 3, policyId: 'p1' });

    await expectAsync(p).toBeResolvedTo({ applicationRules: 1, networkRules: 2, natRules: 3, policyId: 'p1' });
  });
});
