import { Injectable } from '@angular/core';

export const RESOURCE_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  'microsoft.compute/virtualmachines':              { label: 'Virtual Machine',       icon: 'Virtual-Machine.svg' },
  'microsoft.compute/disks':                        { label: 'Managed Disk',          icon: 'Managed-Disks.svg' },
  'microsoft.compute/virtualmachinescalesets':      { label: 'VM Scale Set',          icon: 'VM-Scale-Sets.svg' },
  'microsoft.network/virtualnetworks':              { label: 'Virtual Network',        icon: 'Virtual-Networks.svg' },
  'microsoft.network/subnets':                      { label: 'Subnet',                icon: 'Subnet.svg' },
  'microsoft.network/networksecuritygroups':        { label: 'NSG',                   icon: 'Network-Security-Groups.svg' },
  'microsoft.network/privateendpoints':             { label: 'Private Endpoint',       icon: 'Private-Endpoint.svg' },
  'microsoft.network/publicipaddresses':            { label: 'Public IP',              icon: 'Public-IP-Addresses.svg' },
  'microsoft.network/loadbalancers':                { label: 'Load Balancer',          icon: 'Load-Balancers.svg' },
  'microsoft.network/applicationgateways':          { label: 'App Gateway',            icon: 'Application-Gateways.svg' },
  'microsoft.network/networkinterfaces':            { label: 'Network Interface',      icon: 'Network-Interfaces.svg' },
  'microsoft.network/dnszones':                     { label: 'DNS Zone',               icon: 'DNS-Zones.svg' },
  'microsoft.network/frontdoors':                   { label: 'Front Door',             icon: 'Front-Door-and-CDN-Profiles.svg' },
  'microsoft.web/sites':                            { label: 'App Service',            icon: 'App-Services.svg' },
  'microsoft.web/serverfarms':                      { label: 'App Service Plan',       icon: 'App-Service-Plans.svg' },
  'microsoft.sql/servers':                          { label: 'SQL Server',             icon: 'SQL-Server.svg' },
  'microsoft.sql/servers/databases':                { label: 'SQL Database',           icon: 'SQL-Database.svg' },
  'microsoft.storage/storageaccounts':              { label: 'Storage Account',        icon: 'Storage-Accounts.svg' },
  'microsoft.keyvault/vaults':                      { label: 'Key Vault',              icon: 'Key-Vaults.svg' },
  'microsoft.containerservice/managedclusters':     { label: 'AKS Cluster',            icon: 'Kubernetes-Services.svg' },
  'microsoft.servicebus/namespaces':                { label: 'Service Bus',            icon: 'Service-Bus.svg' },
  'microsoft.eventhub/namespaces':                  { label: 'Event Hub',              icon: 'Event-Hubs.svg' },
  'microsoft.cognitiveservices/accounts':           { label: 'Cognitive Services',     icon: 'Cognitive-Services.svg' },
  'microsoft.insights/components':                  { label: 'App Insights',           icon: 'Application-Insights.svg' },
  'microsoft.operationalinsights/workspaces':       { label: 'Log Analytics',          icon: 'Log-Analytics-Workspaces.svg' },
  'microsoft.cache/redis':                          { label: 'Redis Cache',            icon: 'Cache-Redis.svg' },
  'microsoft.documentdb/databaseaccounts':          { label: 'Cosmos DB',              icon: 'Azure-Cosmos-DB.svg' },
  'microsoft.apimanagement/service':                { label: 'API Management',         icon: 'API-Management-Services.svg' },
  'microsoft.logic/workflows':                      { label: 'Logic App',              icon: 'Logic-Apps.svg' },
  'microsoft.resources/resourcegroups':             { label: 'Resource Group',         icon: 'Resource-Groups.svg' },
};

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
  private readonly cache = new Map<string, string>();
  private readonly BASE_PATH = 'assets/azure-icons/';
  private readonly FALLBACK_ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Crect width='18' height='18' rx='2' fill='%230078d4'/%3E%3Ctext x='9' y='13' text-anchor='middle' font-size='10' fill='white' font-family='sans-serif'%3E%E2%98%81%3C/text%3E%3C/svg%3E`;
  private manifest: Record<string, string> = {};

  async loadManifest(): Promise<void> {
    try {
      const resp = await fetch('assets/azure-icons/icon-manifest.json');
      if (resp.ok) {
        const data = await resp.json();
        this.manifest = data.mappings ?? {};
      }
    } catch {
      // manifest not available, use built-in map
    }
  }

  getIconUrl(resourceType: string): string {
    const normalized = resourceType.toLowerCase();
    if (this.cache.has(normalized)) return this.cache.get(normalized)!;

    const builtIn = RESOURCE_TYPE_MAP[normalized]?.icon;
    const fromManifest = this.manifest[normalized];
    const filename = fromManifest ?? builtIn;

    const url = filename ? `${this.BASE_PATH}${filename}` : this.FALLBACK_ICON;
    this.cache.set(normalized, url);
    return url;
  }

  getTypeLabel(resourceType: string): string {
    return RESOURCE_TYPE_MAP[resourceType.toLowerCase()]?.label ?? this.humanizeType(resourceType);
  }

  private humanizeType(type: string): string {
    const parts = type.split('/');
    const last = parts[parts.length - 1];
    return last.replace(/([A-Z])/g, ' $1').trim();
  }
}
