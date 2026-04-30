import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

export abstract class BaseHttpService {
  protected readonly http = inject(HttpClient);
  protected readonly baseUrl = '/api/az';

  protected get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${this.baseUrl}/${endpoint}`, { params })
    );
  }

  protected get$<T>(endpoint: string, params?: Record<string, string>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { params });
  }
}
