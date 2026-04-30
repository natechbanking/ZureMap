import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { AzureAccount, AzureSubscription } from '../models/azure-resource.model';
import { liftAzError } from '../utils/az-error.utils';

@Injectable({ providedIn: 'root' })
export class AzAuthService {
  private http = inject(HttpClient);

  private readonly base = '/api/az';

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
