import { HttpErrorResponse } from '@angular/common/http';
import { liftAzError } from './az-error.utils';

describe('az-error.utils', () => {
  it('maps Azure error body fields to typed error', (done) => {
    const httpErr = new HttpErrorResponse({
      error: { error: 'Denied', code: 'PERMISSION_DENIED', detail: 'Reader role missing' },
      status: 403,
      statusText: 'Forbidden',
    });

    liftAzError(httpErr).subscribe({
      error: (err: Error & { azCode: string; azDetail: string }) => {
        expect(err.message).toBe('Denied');
        expect(err.azCode).toBe('PERMISSION_DENIED');
        expect(err.azDetail).toBe('Reader role missing');
        done();
      },
    });
  });

  it('falls back when body is missing expected fields', (done) => {
    const httpErr = new HttpErrorResponse({
      error: { foo: 'bar' },
      status: 500,
      statusText: 'Server Error',
    });

    liftAzError(httpErr).subscribe({
      error: (err: Error & { azCode: string; azDetail: string }) => {
        expect(err.message).toContain('Http failure response');
        expect(err.azCode).toBe('SERVER_ERROR');
        expect(err.azDetail).toBe('');
        done();
      },
    });
  });
});
