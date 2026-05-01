import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DnsRecordsService } from './dns-records.service';

describe('DnsRecordsService', () => {
  let service: DnsRecordsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DnsRecordsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DnsRecordsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests DNS records by zone id', async () => {
    const p = service.getRecords('zone-1');
    const req = httpMock.expectOne('/api/az/dns-zone-records?zoneId=zone-1');
    req.flush({ records: [{ name: '@', type: 'A', ttl: 300, values: ['1.1.1.1'] }] });

    await expectAsync(p).toBeResolvedTo({ records: [{ name: '@', type: 'A', ttl: 300, values: ['1.1.1.1'] }] });
  });
});
