import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, from, EMPTY } from 'rxjs';
import { AzureResource } from '../models/azure-resource.model';

const ALL_RESOURCES_KQL = `
Resources
| project id, name, type, location, resourceGroup, subscriptionId, tags, properties, sku, kind
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
        const errBody = await resp.text().catch(() => '');
        throw new Error(`Resource Graph query failed: ${resp.status} — ${errBody}`);
      }
      const data = await resp.json() as ResourceGraphResponse;
      allResources.push(...(data.data ?? []));
      skipToken = data.$skipToken;
    } while (skipToken);

    return allResources;
  }
}
