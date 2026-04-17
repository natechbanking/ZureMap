import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map } from 'rxjs';
import { AzureAccount, AzureSubscription } from '../models/azure-resource.model';

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
    return this.http.post<void>(`${this.base}/login`, {});
  }

  listSubscriptions(): Observable<AzureSubscription[]> {
    return this.http.get<AzureSubscription[]>(`${this.base}/subscriptions`);
  }

  getAccessToken(resource = 'https://management.azure.com/'): Observable<{ accessToken: string; expiresOn: string }> {
    return this.http.get<{ accessToken: string; expiresOn: string }>(
      `${this.base}/token`, { params: { resource } }
    );
  }
}
