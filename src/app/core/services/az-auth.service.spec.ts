import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AzAuthService } from './az-auth.service';

describe('AzAuthService', () => {
  let service: AzAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AzAuthService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AzAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('checks login status', () => {
    let result: { loggedIn: boolean } | undefined;
    service.checkLoginStatus().subscribe(v => (result = v));

    httpMock.expectOne('/api/az/login-status').flush({ loggedIn: true });
    expect(result).toEqual({ loggedIn: true });
  });

  it('posts login', () => {
    service.login().subscribe();
    const req = httpMock.expectOne('/api/az/login');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('lists subscriptions', () => {
    let result: unknown;
    service.listSubscriptions().subscribe(v => (result = v));
    httpMock.expectOne('/api/az/subscriptions').flush([{ id: 'a', subscriptionId: 's', name: 'n', state: 'Enabled', tenantId: 't' }]);
    expect(Array.isArray(result)).toBeTrue();
  });

  it('requests access token with default resource', () => {
    let result: unknown;
    service.getAccessToken().subscribe(v => (result = v));

    const req = httpMock.expectOne('/api/az/token?resource=https://management.azure.com/');
    req.flush({ accessToken: 'tok', expiresOn: 'tomorrow' });

    expect(result).toEqual({ accessToken: 'tok', expiresOn: 'tomorrow' });
  });
});
