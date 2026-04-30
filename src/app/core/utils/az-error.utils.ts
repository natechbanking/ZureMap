import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

export interface AzureError extends Error {
  azCode: string;
  azDetail: string;
}

/**
 * Converts an HttpErrorResponse from an Azure API call into a typed AzureError.
 * Use with RxJS `catchError`: `pipe(catchError(liftAzError))`.
 */
export function liftAzError(httpErr: HttpErrorResponse): Observable<never> {
  const body = httpErr.error as Record<string, unknown> | null;
  const message = typeof body?.['error'] === 'string' ? body['error'] : httpErr.message;
  const code = typeof body?.['code'] === 'string' ? body['code'] : 'SERVER_ERROR';
  const detail = typeof body?.['detail'] === 'string' ? body['detail'] : '';
  return throwError(() => Object.assign(new Error(message), { azCode: code, azDetail: detail } satisfies Omit<AzureError, keyof Error>));
}
