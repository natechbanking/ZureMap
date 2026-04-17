import { Injectable } from '@angular/core';

export const RESOURCE_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  'microsoft.compute/virtualmachines':              { label: 'Virtual Machine',       icon: 'compute/10021-icon-service-Virtual-Machine.svg' },
  'microsoft.compute/disks':                        { label: 'Managed Disk',          icon: 'compute/10032-icon-service-Disks.svg' },
  'microsoft.compute/virtualmachinescalesets':      { label: 'VM Scale Set',          icon: 'compute/10034-icon-service-VM-Scale-Sets.svg' },
  'microsoft.network/virtualnetworks':              { label: 'Virtual Network',        icon: 'networking/10061-icon-service-Virtual-Networks.svg' },
  'microsoft.network/subnets':                      { label: 'Subnet',                icon: 'networking/02742-icon-service-Subnet.svg' },
  'microsoft.network/networksecuritygroups':        { label: 'NSG',                   icon: 'networking/10067-icon-service-Network-Security-Groups.svg' },
  'microsoft.network/privateendpoints':             { label: 'Private Endpoint',       icon: 'other/02579-icon-service-Private-Endpoints.svg' },
  'microsoft.network/publicipaddresses':            { label: 'Public IP',              icon: 'networking/10069-icon-service-Public-IP-Addresses.svg' },
  'microsoft.network/loadbalancers':                { label: 'Load Balancer',          icon: 'networking/10062-icon-service-Load-Balancers.svg' },
  'microsoft.network/applicationgateways':          { label: 'App Gateway',            icon: 'networking/10076-icon-service-Application-Gateways.svg' },
  'microsoft.network/networkinterfaces':            { label: 'Network Interface',      icon: 'networking/10080-icon-service-Network-Interfaces.svg' },
  'microsoft.network/dnszones':                     { label: 'DNS Zone',               icon: 'networking/10064-icon-service-DNS-Zones.svg' },
  'microsoft.network/frontdoors':                   { label: 'Front Door',             icon: 'networking/10073-icon-service-Front-Door-and-CDN-Profiles.svg' },
  'microsoft.web/sites':                            { label: 'App Service',            icon: 'app services/10035-icon-service-App-Services.svg' },
  'microsoft.web/serverfarms':                      { label: 'App Service Plan',       icon: 'app services/00046-icon-service-App-Service-Plans.svg' },
  'microsoft.sql/servers':                          { label: 'SQL Server',             icon: 'databases/10132-icon-service-SQL-Server.svg' },
  'microsoft.sql/servers/databases':                { label: 'SQL Database',           icon: 'databases/10130-icon-service-SQL-Database.svg' },
  'microsoft.storage/storageaccounts':              { label: 'Storage Account',        icon: 'storage/10086-icon-service-Storage-Accounts.svg' },
  'microsoft.keyvault/vaults':                      { label: 'Key Vault',              icon: 'security/10245-icon-service-Key-Vaults.svg' },
  'microsoft.containerservice/managedclusters':     { label: 'AKS Cluster',            icon: 'compute/10023-icon-service-Kubernetes-Services.svg' },
  'microsoft.servicebus/namespaces':                { label: 'Service Bus',            icon: 'integration/10836-icon-service-Azure-Service-Bus.svg' },
  'microsoft.eventhub/namespaces':                  { label: 'Event Hub',              icon: 'analytics/00039-icon-service-Event-Hubs.svg' },
  'microsoft.cognitiveservices/accounts':           { label: 'Cognitive Services',     icon: 'ai + machine learning/10162-icon-service-Cognitive-Services.svg' },
  'microsoft.insights/components':                  { label: 'App Insights',           icon: 'management + governance/00012-icon-service-Application-Insights.svg' },
  'microsoft.operationalinsights/workspaces':       { label: 'Log Analytics',          icon: 'management + governance/00009-icon-service-Log-Analytics-Workspaces.svg' },
  'microsoft.cache/redis':                          { label: 'Redis Cache',            icon: 'databases/10137-icon-service-Cache-Redis.svg' },
  'microsoft.documentdb/databaseaccounts':          { label: 'Cosmos DB',              icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.apimanagement/service':                { label: 'API Management',         icon: 'integration/10042-icon-service-API-Management-Services.svg' },
  'microsoft.logic/workflows':                      { label: 'Logic App',              icon: 'integration/02631-icon-service-Logic-Apps.svg' },
  'microsoft.resources/resourcegroups':             { label: 'Resource Group',         icon: 'general/10007-icon-service-Resource-Groups.svg' },
};

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
  private readonly cache = new Map<string, string>();
  private readonly BASE_PATH = 'icons/';
  private readonly FALLBACK_ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Crect width='18' height='18' rx='2' fill='%230078d4'/%3E%3Ctext x='9' y='13' text-anchor='middle' font-size='10' fill='white' font-family='sans-serif'%3E%E2%98%81%3C/text%3E%3C/svg%3E`;
  private manifest: Record<string, string> = {};

  async loadManifest(): Promise<void> {
    try {
      const resp = await fetch('icons/icon-manifest.json');
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
