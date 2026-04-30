import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';

export interface DnsRecord {
  name: string;
  type: string;
  ttl: number | null;
  values: string[];
}

export interface DnsZoneDetails {
  records: DnsRecord[];
}

@Injectable({ providedIn: 'root' })
export class DnsRecordsService extends BaseHttpService {
  getRecords(zoneId: string): Promise<DnsZoneDetails> {
    return this.get('dns-zone-records', { zoneId });
  }
}
