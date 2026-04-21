import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface StorageDetails {
  containers: string[];
  fileShares: string[];
  tables: string[];
  queues: string[];
}

@Injectable({ providedIn: 'root' })
export class StorageDetailsService {
  private readonly base = '/api/az';

  constructor(private http: HttpClient) {}

  async getDetails(storageAccountId: string): Promise<StorageDetails> {
    return firstValueFrom(
      this.http.get<StorageDetails>(`${this.base}/storage-details`, {
        params: { accountId: storageAccountId },
      })
    );
  }
}
