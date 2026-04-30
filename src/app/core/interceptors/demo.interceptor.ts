import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

const DEMO_SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000001';

const CANNED: Record<string, unknown> = {
  '/api/az/login-status': {
    loggedIn: true,
    account: {
      id: DEMO_SUBSCRIPTION_ID,
      name: 'demo@contoso.com',
      user: { name: 'demo@contoso.com', type: 'user' },
      tenantId: '00000000-0000-0000-0000-000000000099',
    },
  },
  '/api/az/subscriptions': [
    {
      id: `/subscriptions/${DEMO_SUBSCRIPTION_ID}`,
      subscriptionId: DEMO_SUBSCRIPTION_ID,
      name: 'Contoso – Production',
      state: 'Enabled',
      tenantId: '00000000-0000-0000-0000-000000000099',
      tenantName: 'Contoso',
    },
  ],
  '/api/az/storage-details': {
    containers: ['assets', 'backups', 'exports', 'uploads'],
    fileShares: ['shared-config'],
    tables: ['AuditLogs', 'MetricsCache'],
    queues: ['job-queue', 'notification-queue'],
  },
  '/api/az/dns-zone-records': {
    records: [
      { name: '@', type: 'SOA', ttl: 3600, values: ['ns1-01.azure-dns.com.'] },
      { name: 'api', type: 'A', ttl: 300, values: ['10.0.1.10'] },
      { name: 'app', type: 'CNAME', ttl: 300, values: ['app-contoso-api.azurewebsites.net'] },
      { name: 'mail', type: 'MX', ttl: 3600, values: ['10 mail.contoso.com.'] },
    ],
  },
  '/api/az/firewall-policy-rule-counts': {
    applicationRules: 14,
    networkRules: 8,
    natRules: 2,
    policyId: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/resourceGroups/rg-networking/providers/Microsoft.Network/firewallPolicies/fw-policy-prod`,
  },
  '/api/az/uai-role-assignments': [
    {
      id: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/providers/Microsoft.Authorization/roleAssignments/aaa00001`,
      roleDefinitionName: 'AcrPull',
      scope: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/resourceGroups/rg-compute/providers/Microsoft.ContainerRegistry/registries/acrcontosoprod`,
      principalType: 'ServicePrincipal',
      description: null,
    },
    {
      id: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/providers/Microsoft.Authorization/roleAssignments/aaa00002`,
      roleDefinitionName: 'Key Vault Secrets User',
      scope: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/resourceGroups/rg-data/providers/Microsoft.KeyVault/vaults/kv-contoso-prod`,
      principalType: 'ServicePrincipal',
      description: null,
    },
    {
      id: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/providers/Microsoft.Authorization/roleAssignments/aaa00003`,
      roleDefinitionName: 'Storage Blob Data Reader',
      scope: `/subscriptions/${DEMO_SUBSCRIPTION_ID}/resourceGroups/rg-data/providers/Microsoft.Storage/storageAccounts/stcontoso001`,
      principalType: 'ServicePrincipal',
      description: null,
    },
  ],
};

function matchUrl(url: string): unknown | null {
  for (const [pattern, body] of Object.entries(CANNED)) {
    if (url.includes(pattern)) return body;
  }
  return null;
}

export function demoInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  if (!environment.isDemo) return next(req);

  const match = matchUrl(req.url);
  if (match !== null) {
    return of(new HttpResponse({ status: 200, body: match }));
  }

  return next(req);
}
