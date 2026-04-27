import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
export class DnsRecordsService {
  private readonly base = '/api/az';

  constructor(private http: HttpClient) {}

  async getRecords(zoneId: string): Promise<DnsZoneDetails> {
    return firstValueFrom(
      this.http.get<DnsZoneDetails>(`${this.base}/dns-zone-records`, {
        params: { zoneId },
      })
    );
  }
}
