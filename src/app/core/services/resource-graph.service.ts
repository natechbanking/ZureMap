import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, from, EMPTY } from 'rxjs';
import { AzureResource } from '../models/azure-resource.model';

const ALL_RESOURCES_KQL = `
Resources
| project id, name, type, location, resourceGroup, subscriptionId, tags, properties, sku, kind, identity
| order by type asc
`;

const VNET_TOPOLOGY_KQL = `
Resources
| where type =~ "microsoft.network/virtualnetworks"
| extend subnets = properties.subnets
| mv-expand subnets
| project id, name, type, location, resourceGroup, subscriptionId,
    vnet_subnet_id = tostring(subnets.id), properties, tags
`;

const PRIVATE_ENDPOINTS_KQL = `
Resources
| where type =~ "microsoft.network/privateendpoints"
| project id, name, type, location, resourceGroup, subscriptionId, properties, tags
`;

const NETWORK_INTERFACES_KQL = `
Resources
| where type =~ "microsoft.network/networkinterfaces"
| project id, name, type, location, resourceGroup, subscriptionId, properties, tags
`;

const STORAGE_SUB_RESOURCES_KQL = `
StorageAccountResources
| where type in~ (
    "microsoft.storage/storageaccounts/blobservices/containers",
    "microsoft.storage/storageaccounts/fileservices/shares",
    "microsoft.storage/storageaccounts/tableservices/tables",
    "microsoft.storage/storageaccounts/queueservices/queues"
  )
| project id, name, type, resourceGroup, subscriptionId, properties
`;

// Fallback: some tenants/API versions surface these in the main Resources table
const STORAGE_SUB_RESOURCES_FALLBACK_KQL = `
Resources
| where type in~ (
    "microsoft.storage/storageaccounts/blobservices/containers",
    "microsoft.storage/storageaccounts/fileservices/shares",
    "microsoft.storage/storageaccounts/tableservices/tables",
    "microsoft.storage/storageaccounts/queueservices/queues"
  )
| project id, name, type, resourceGroup, subscriptionId, properties
`;

interface ResourceGraphResponse {
  data: AzureResource[];
  $skipToken?: string;
}

@Injectable({ providedIn: 'root' })
export class ResourceGraphService {
  private readonly base = '/api/az';

  constructor(private http: HttpClient) {}

  queryAllResources(subscriptionIds: string[]): Observable<AzureResource[]> {
    return this.queryPaginated(
      ALL_RESOURCES_KQL,
      subscriptionIds
    );
  }

  queryVNetTopology(subscriptionIds: string[]): Observable<AzureResource[]> {
    return this.queryPaginated(VNET_TOPOLOGY_KQL, subscriptionIds);
  }

  queryPrivateEndpoints(subscriptionIds: string[]): Observable<AzureResource[]> {
    return this.queryPaginated(PRIVATE_ENDPOINTS_KQL, subscriptionIds);
  }

  queryNetworkInterfaces(subscriptionIds: string[]): Observable<AzureResource[]> {
    return this.queryPaginated(NETWORK_INTERFACES_KQL, subscriptionIds);
  }

  async queryStorageSubResources(subscriptionIds: string[]): Promise<AzureResource[]> {
    // Try the dedicated StorageAccountResources table first; fall back to Resources table
    try {
      return await this.queryPaginated(STORAGE_SUB_RESOURCES_KQL, subscriptionIds).toPromise() ?? [];
    } catch {
      return await this.queryPaginated(STORAGE_SUB_RESOURCES_FALLBACK_KQL, subscriptionIds).toPromise() ?? [];
    }
  }

  streamAllResources(subscriptionIds: string[]): Observable<AzureResource[]> {
    const subject = new Subject<AzureResource[]>();
    const url = `/api/az/scan-stream?subscriptionIds=${subscriptionIds.join(',')}`;
    const es = new EventSource(url);

    es.onmessage = (event: MessageEvent) => {
      if (event.data === '[DONE]') {
        es.close();
        subject.complete();
        return;
      }
      try {
        const batch = JSON.parse(event.data) as AzureResource[];
        subject.next(batch);
      } catch {
        // skip malformed batch
      }
    };
    es.onerror = (err) => {
      es.close();
      subject.error(err);
    };
    return subject.asObservable();
  }

  private queryPaginated(kql: string, subscriptionIds: string[]): Observable<AzureResource[]> {
    return from(this.fetchAllPages(kql, subscriptionIds));
  }

  private async fetchAllPages(kql: string, subscriptionIds: string[]): Promise<AzureResource[]> {
    const allResources: AzureResource[] = [];
    let skipToken: string | undefined;

    do {
      const body: Record<string, unknown> = {
        query: kql.replace(/\{\{subIds\}\}/g, subscriptionIds.map(id => `'${id}'`).join(', ')),
        subscriptions: subscriptionIds,
      };
      if (skipToken) body['$skipToken'] = skipToken;

      const resp = await fetch(`${this.base}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        let friendly = `Resource Graph query failed (HTTP ${resp.status})`;
        let code = 'SERVER_ERROR';
        let detail = '';
        try {
          const errBody = await resp.json();
          if (errBody?.error) friendly = errBody.error;
          if (errBody?.code) code = errBody.code;
          if (errBody?.detail) detail = errBody.detail;
        } catch { /* ignore parse errors */ }
        throw Object.assign(new Error(friendly), { azCode: code, azDetail: detail });
      }
      const data = await resp.json() as ResourceGraphResponse;
      allResources.push(...(data.data ?? []));
      skipToken = data.$skipToken;
    } while (skipToken);

    return allResources;
  }
}
