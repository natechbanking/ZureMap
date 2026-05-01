import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BaseHttpService } from './base-http.service';

class TestHttpService extends BaseHttpService {
  read<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.get<T>(endpoint, params);
  }

  read$<T>(endpoint: string, params?: Record<string, string>) {
    return this.get$<T>(endpoint, params);
  }
}

describe('BaseHttpService', () => {
  let service: TestHttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestHttpService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TestHttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('get resolves promise with endpoint and params', async () => {
    const promise = service.read<{ ok: boolean }>('ping', { id: '1' });
    const req = httpMock.expectOne('/api/az/ping?id=1');
    req.flush({ ok: true });

    await expectAsync(promise).toBeResolvedTo({ ok: true });
  });

  it('get$ returns observable response', () => {
    let result: { value: number } | undefined;
    service.read$<{ value: number }>('stream').subscribe(v => (result = v));

    const req = httpMock.expectOne('/api/az/stream');
    req.flush({ value: 7 });

    expect(result).toEqual({ value: 7 });
  });
});
