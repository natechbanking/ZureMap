import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { StorageDetailsService } from './storage-details.service';

describe('StorageDetailsService', () => {
  let service: StorageDetailsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [StorageDetailsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StorageDetailsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests storage details by account id', async () => {
    const p = service.getDetails('acc-1');
    const req = httpMock.expectOne('/api/az/storage-details?accountId=acc-1');
    req.flush({ containers: [], fileShares: ['fs1'], tables: [], queues: [] });

    await expectAsync(p).toBeResolvedTo({ containers: [], fileShares: ['fs1'], tables: [], queues: [] });
  });
});
