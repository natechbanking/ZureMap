import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { AzureAccount, AzureSubscription } from '../models/azure-resource.model';

function liftAzError(httpErr: HttpErrorResponse): Observable<never> {
  const body = httpErr.error as Record<string, unknown> | null;
  const message = typeof body?.['error'] === 'string' ? body['error'] : httpErr.message;
  const code = typeof body?.['code'] === 'string' ? body['code'] : 'SERVER_ERROR';
  const detail = typeof body?.['detail'] === 'string' ? body['detail'] : '';
  return throwError(() => Object.assign(new Error(message), { azCode: code, azDetail: detail }));
}

@Injectable({ providedIn: 'root' })
export class AzAuthService {
  private readonly base = '/api/az';

  constructor(private http: HttpClient) {}

  checkLoginStatus(): Observable<{ loggedIn: boolean; account?: AzureAccount }> {
    return this.http.get<{ loggedIn: boolean; account?: AzureAccount }>(
      `${this.base}/login-status`
    );
  }

  login(): Observable<void> {
    return this.http.post<void>(`${this.base}/login`, {}).pipe(catchError(liftAzError));
  }

  listSubscriptions(): Observable<AzureSubscription[]> {
    return this.http.get<AzureSubscription[]>(`${this.base}/subscriptions`).pipe(catchError(liftAzError));
  }

  getAccessToken(resource = 'https://management.azure.com/'): Observable<{ accessToken: string; expiresOn: string }> {
    return this.http.get<{ accessToken: string; expiresOn: string }>(
      `${this.base}/token`, { params: { resource } }
    ).pipe(catchError(liftAzError));
  }
}
