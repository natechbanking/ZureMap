import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';

export interface AzureFirewallPolicyRuleCounts {
  applicationRules: number;
  networkRules: number;
  natRules: number;
  policyId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AzureFirewallDetailsService extends BaseHttpService {
  getPolicyRuleCounts(firewallId: string): Promise<AzureFirewallPolicyRuleCounts> {
    return this.get('firewall-policy-rule-counts', { firewallId });
  }
}
