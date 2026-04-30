import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';

export interface StorageDetails {
  containers: string[];
  fileShares: string[];
  tables: string[];
  queues: string[];
}

@Injectable({ providedIn: 'root' })
export class StorageDetailsService extends BaseHttpService {
  getDetails(storageAccountId: string): Promise<StorageDetails> {
    return this.get('storage-details', { accountId: storageAccountId });
  }
}
