import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { AzureAccount, AzureSubscription } from '../models/azure-resource.model';
import { liftAzError } from '../utils/az-error.utils';

export interface DeviceCodeLogin {
  verificationUrl: string;
  userCode: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AzAuthService {
  private http = inject(HttpClient);

  private readonly base = '/api/az';

  checkLoginStatus(): Observable<{ loggedIn: boolean; account?: AzureAccount; error?: string; code?: string; detail?: string }> {
    return this.http.get<{ loggedIn: boolean; account?: AzureAccount; error?: string; code?: string; detail?: string }>(
      `${this.base}/login-status`
    );
  }

  login(): Observable<void> {
    return this.http.post<void>(`${this.base}/login`, {}).pipe(catchError(liftAzError));
  }

  loginWithDeviceCode(): Observable<DeviceCodeLogin> {
    return this.http.post<DeviceCodeLogin>(`${this.base}/login-device-code`, {}).pipe(catchError(liftAzError));
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
