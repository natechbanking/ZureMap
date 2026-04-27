import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AzureFirewallPolicyRuleCounts {
  applicationRules: number;
  networkRules: number;
  natRules: number;
  policyId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AzureFirewallDetailsService {
  private readonly base = '/api/az';

  constructor(private http: HttpClient) {}

  async getPolicyRuleCounts(firewallId: string): Promise<AzureFirewallPolicyRuleCounts> {
    return firstValueFrom(
      this.http.get<AzureFirewallPolicyRuleCounts>(`${this.base}/firewall-policy-rule-counts`, {
        params: { firewallId },
      })
    );
  }
}
