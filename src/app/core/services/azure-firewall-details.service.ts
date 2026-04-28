import { Injectable, inject } from '@angular/core';
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
  private http = inject(HttpClient);

  private readonly base = '/api/az';

  async getPolicyRuleCounts(firewallId: string): Promise<AzureFirewallPolicyRuleCounts> {
    return firstValueFrom(
      this.http.get<AzureFirewallPolicyRuleCounts>(`${this.base}/firewall-policy-rule-counts`, {
        params: { firewallId },
      })
    );
  }
}
