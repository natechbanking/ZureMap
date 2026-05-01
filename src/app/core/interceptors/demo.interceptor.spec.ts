import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { demoInterceptor } from './demo.interceptor';
import { environment } from '../../../environments/environment';

describe('demoInterceptor', () => {
  let originalDemo: boolean;

  beforeEach(() => {
    originalDemo = environment.isDemo;
  });

  afterEach(() => {
    environment.isDemo = originalDemo;
  });

  it('passes through when demo mode is disabled', (done) => {
    environment.isDemo = false;
    const req = new HttpRequest('GET', '/api/az/login-status');
    const next = jasmine.createSpy('next').and.returnValue(of(new HttpResponse({ status: 204 })));

    demoInterceptor(req, next).subscribe((res) => {
      expect(next).toHaveBeenCalledWith(req);
      expect((res as HttpResponse<unknown>).status).toBe(204);
      done();
    });
  });

  it('returns canned response in demo mode for matched endpoint', (done) => {
    environment.isDemo = true;
    const req = new HttpRequest('GET', '/api/az/subscriptions');
    const next = jasmine.createSpy('next').and.returnValue(of(new HttpResponse({ status: 500 })));

    demoInterceptor(req, next).subscribe((res) => {
      const response = res as HttpResponse<unknown>;
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTrue();
      expect(next).not.toHaveBeenCalled();
      done();
    });
  });

  it('falls through in demo mode when endpoint is not canned', (done) => {
    environment.isDemo = true;
    const req = new HttpRequest('GET', '/api/az/unknown');
    const next = jasmine.createSpy('next').and.returnValue(of(new HttpResponse({ status: 201 })));

    demoInterceptor(req, next).subscribe((res) => {
      expect(next).toHaveBeenCalledWith(req);
      expect((res as HttpResponse<unknown>).status).toBe(201);
      done();
    });
  });
});
