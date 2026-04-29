import { Injectable } from '@angular/core';

export const RESOURCE_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  'microsoft.compute/virtualmachines':              { label: 'Virtual Machine',       icon: 'compute/10021-icon-service-Virtual-Machine.svg' },
  'microsoft.compute/disks':                        { label: 'Managed Disk',          icon: 'compute/10032-icon-service-Disks.svg' },
  'microsoft.compute/virtualmachinescalesets':      { label: 'VM Scale Set',          icon: 'compute/10034-icon-service-VM-Scale-Sets.svg' },
  'microsoft.compute/images':                       { label: 'Image',                 icon: 'compute/10033-icon-service-Images.svg' },
  'microsoft.compute/galleries':                    { label: 'Gallery',               icon: 'compute/10039-icon-service-Shared-Image-Galleries.svg' },
  'microsoft.compute/galleries/images':             { label: 'Gallery Image',         icon: 'compute/10033-icon-service-Images.svg' },
  'microsoft.compute/galleries/images/versions':    { label: 'Image Version',         icon: 'compute/10038-icon-service-Image-Versions.svg' },
  'microsoft.compute/galleries/images/versions/replications': { label: 'Image Replication', icon: 'compute/10038-icon-service-Image-Versions.svg' },
  'microsoft.network/virtualnetworks':              { label: 'Virtual Network',        icon: 'networking/10061-icon-service-Virtual-Networks.svg' },
  'microsoft.network/subnets':                      { label: 'Subnet',                icon: 'networking/02742-icon-service-Subnet.svg' },
  'microsoft.network/networksecuritygroups':        { label: 'NSG',                   icon: 'networking/10067-icon-service-Network-Security-Groups.svg' },
  'microsoft.network/privateendpoints':             { label: 'Private Endpoint',       icon: 'other/02579-icon-service-Private-Endpoints.svg' },
  'microsoft.network/publicipaddresses':            { label: 'Public IP',              icon: 'networking/10069-icon-service-Public-IP-Addresses.svg' },
  'microsoft.network/loadbalancers':                { label: 'Load Balancer',          icon: 'networking/10062-icon-service-Load-Balancers.svg' },
  'microsoft.network/applicationgateways':          { label: 'App Gateway',            icon: 'networking/10076-icon-service-Application-Gateways.svg' },
  'microsoft.network/networkinterfaces':            { label: 'Network Interface',      icon: 'networking/10080-icon-service-Network-Interfaces.svg' },
  'microsoft.network/connections':                  { label: 'Connection',             icon: 'networking/10081-icon-service-Connections.svg' },
  'microsoft.network/virtualnetworkgateways':       { label: 'Virtual Network Gateway', icon: 'networking/10063-icon-service-Virtual-Network-Gateways.svg' },
  'microsoft.network/localnetworkgateways':         { label: 'Local Network Gateway',  icon: 'networking/10077-icon-service-Local-Network-Gateways.svg' },
  'microsoft.network/firewallpolicies':             { label: 'Firewall Policy',        icon: 'networking/00272-icon-service-Azure-Firewall-Policy.svg' },
  'microsoft.network/bastionhosts':                 { label: 'Bastion Host',           icon: 'networking/02422-icon-service-Bastions.svg' },
  'microsoft.network/dnsresolvers':                 { label: 'DNS Resolver',           icon: 'networking/02882-icon-service-DNS-Private-Resolver.svg' },
  'microsoft.network/dnsresolvers/inboundendpoints': { label: 'Inbound Endpoint',      icon: 'networking/02882-icon-service-DNS-Private-Resolver.svg' },
  'microsoft.network/dnsresolvers/outboundendpoints': { label: 'Outbound Endpoint',    icon: 'networking/02882-icon-service-DNS-Private-Resolver.svg' },
  'microsoft.network/expressroutecircuits':         { label: 'ExpressRoute Circuit',   icon: 'networking/10079-icon-service-ExpressRoute-Circuits.svg' },
  'microsoft.network/networkintentpolicies':        { label: 'Network Intent Policy', icon: 'networking/00272-icon-service-Azure-Firewall-Policy.svg' },
  'microsoft.network/privatelinkservices':          { label: 'Private Link Service',  icon: 'networking/02209-icon-service-Private-Link-Services.svg' },
  'microsoft.network/serviceendpointpolicies':      { label: 'Service Endpoint Policy', icon: 'networking/10085-icon-service-Service-Endpoint-Policies.svg' },
  'microsoft.network/dnsforwardingrulesets':        { label: 'DNS Forwarding Ruleset', icon: 'networking/02882-icon-service-DNS-Private-Resolver.svg' },
  'microsoft.network/dnsforwardingrulesets/virtualnetworklinks': { label: 'Virtual Network Link', icon: 'networking/10061-icon-service-Virtual-Networks.svg' },
  'microsoft.network/dnszones':                     { label: 'DNS Zone',               icon: 'networking/10064-icon-service-DNS-Zones.svg' },
  'microsoft.network/dnszones/virtualnetworklinks': { label: 'Virtual Network Link',   icon: 'networking/10061-icon-service-Virtual-Networks.svg' },
  'microsoft.network/privatednszones':              { label: 'Private DNS Zone',       icon: 'networking/10064-icon-service-DNS-Zones.svg' },
  'microsoft.network/privatednszones/virtualnetworklinks': { label: 'Virtual Network Link', icon: 'networking/10061-icon-service-Virtual-Networks.svg' },
  'microsoft.network/networkwatchers':              { label: 'Network Watcher',       icon: 'networking/10066-icon-service-Network-Watcher.svg' },
  'microsoft.network/frontdoors':                   { label: 'Front Door',             icon: 'networking/10073-icon-service-Front-Door-and-CDN-Profiles.svg' },
  'microsoft.network/azurefirewalls':              { label: 'Azure Firewall',         icon: 'networking/10084-icon-service-Firewalls.svg' },
  'microsoft.network/routetables':                  { label: 'Route Table',            icon: 'networking/10082-icon-service-Route-Tables.svg' },
  'microsoft.network/routetables/routes':           { label: 'Route',                  icon: 'networking/10082-icon-service-Route-Tables.svg' },
  'microsoft.web/sites':                            { label: 'App Service',            icon: 'app services/10035-icon-service-App-Services.svg' },
  'microsoft.web/sites/slots':                      { label: 'App Service Slot',       icon: 'app services/10035-icon-service-App-Services.svg' },
  'microsoft.web/serverfarms':                      { label: 'App Service Plan',       icon: 'app services/00046-icon-service-App-Service-Plans.svg' },
  'microsoft.web/hostingenvironments':              { label: 'App Service Environment', icon: 'app services/10047-icon-service-App-Service-Environments.svg' },
  'microsoft.web/certificates':                     { label: 'Certificate',           icon: 'app services/00049-icon-service-App-Service-Certificates.svg' },
  'microsoft.desktopvirtualization/hostpools':      { label: 'Host Pool',             icon: 'compute/00328-icon-service-Host-Pools.svg' },
  'microsoft.desktopvirtualization/applicationgroups': { label: 'Application Group',  icon: 'compute/00329-icon-service-Application-Group.svg' },
  'microsoft.desktopvirtualization/workspaces':     { label: 'Workspace',             icon: 'compute/00330-icon-service-Workspaces.svg' },
  'microsoft.datafactory/factories':                { label: 'Data Factory',          icon: 'analytics/10126-icon-service-Data-Factories.svg' },
  'microsoft.app/managedenvironments':              { label: 'Managed Environment',   icon: 'other/02989-icon-service-Container-Apps-Environments.svg' },
  'microsoft.app/jobs':                             { label: 'Job',                   icon: 'other/10846-icon-service-Web-Jobs.svg' },
  'microsoft.containerregistry/registries':         { label: 'Container Registry',     icon: 'containers/10105-icon-service-Container-Registries.svg' },
  'microsoft.managedidentity/userassignedidentities': { label: 'User Assigned Identity', icon: 'identity/10230-icon-service-Users.svg' },
  'microsoft.sql/servers':                          { label: 'SQL Server',             icon: 'databases/10132-icon-service-SQL-Server.svg' },
  'microsoft.sql/servers/databases':                { label: 'SQL Database',           icon: 'databases/10130-icon-service-SQL-Database.svg' },
  'microsoft.sql/managedinstances':                 { label: 'SQL Managed Instance',   icon: 'databases/10136-icon-service-SQL-Managed-Instance.svg' },
  'microsoft.sql/virtualclusters':                  { label: 'Virtual Cluster',       icon: 'databases/10127-icon-service-Virtual-Clusters.svg' },
  'microsoft.sql/managedinstances/databases':       { label: 'Managed Instance DB',    icon: 'databases/10135-icon-service-Managed-Database.svg' },
  'microsoft.dbforpostgresql/servers':              { label: 'PostgreSQL Server',      icon: 'databases/10131-icon-service-Azure-Database-PostgreSQL-Server.svg' },
  'microsoft.dbforpostgresql/servers/databases':    { label: 'PostgreSQL Database',    icon: 'databases/10131-icon-service-Azure-Database-PostgreSQL-Server.svg' },
  'microsoft.dbforpostgresql/flexibleservers':      { label: 'PostgreSQL Flexible',    icon: 'databases/10131-icon-service-Azure-Database-PostgreSQL-Server.svg' },
  'microsoft.dbforpostgresql/flexibleservers/databases': { label: 'PostgreSQL DB',     icon: 'databases/10131-icon-service-Azure-Database-PostgreSQL-Server.svg' },
  'microsoft.dbformysql/servers':                   { label: 'MySQL Server',           icon: 'databases/10122-icon-service-Azure-Database-MySQL-Server.svg' },
  'microsoft.dbformysql/servers/databases':         { label: 'MySQL Database',         icon: 'databases/10122-icon-service-Azure-Database-MySQL-Server.svg' },
  'microsoft.dbformysql/flexibleservers':           { label: 'MySQL Flexible',         icon: 'databases/10122-icon-service-Azure-Database-MySQL-Server.svg' },
  'microsoft.dbformysql/flexibleservers/databases': { label: 'MySQL DB',               icon: 'databases/10122-icon-service-Azure-Database-MySQL-Server.svg' },
  'microsoft.dbformariadb/servers':                 { label: 'MariaDB Server',         icon: 'databases/10123-icon-service-Azure-Database-MariaDB-Server.svg' },
  'microsoft.dbformariadb/servers/databases':       { label: 'MariaDB Database',       icon: 'databases/10123-icon-service-Azure-Database-MariaDB-Server.svg' },
  'microsoft.storage/storageaccounts':              { label: 'Storage Account',        icon: 'storage/10086-icon-service-Storage-Accounts.svg' },
  'microsoft.keyvault/vaults':                      { label: 'Key Vault',              icon: 'security/10245-icon-service-Key-Vaults.svg' },
  'microsoft.containerservice/managedclusters':     { label: 'AKS Cluster',            icon: 'compute/10023-icon-service-Kubernetes-Services.svg' },
  'microsoft.servicebus/namespaces':                { label: 'Service Bus',            icon: 'integration/10836-icon-service-Azure-Service-Bus.svg' },
  'microsoft.eventhub/namespaces':                  { label: 'Event Hub',              icon: 'analytics/00039-icon-service-Event-Hubs.svg' },
  'microsoft.notificationhubs/namespaces':          { label: 'Notification Hub Namespace', icon: 'web/10053-icon-service-Notification-Hub-Namespaces.svg' },
  'microsoft.notificationhubs/namespaces/notificationhubs': { label: 'Notification Hub', icon: 'app services/10045-icon-service-Notification-Hubs.svg' },
  'microsoft.cognitiveservices/accounts':           { label: 'Cognitive Services',     icon: 'ai + machine learning/10162-icon-service-Cognitive-Services.svg' },
  'microsoft.insights/components':                  { label: 'App Insights',           icon: 'management + governance/00012-icon-service-Application-Insights.svg' },
  'microsoft.insights/workbooks':                   { label: 'Workbook',               icon: 'monitor/02189-icon-service-Azure-Workbooks.svg' },
  'microsoft.insights/actiongroups':                { label: 'Action Group',           icon: 'monitor/00001-icon-service-Monitor.svg' },
  'microsoft.insights/datacollectionrules':         { label: 'Data Collection Rule',  icon: 'other/01857-icon-service-Data-Collection-Rules.svg' },
  'microsoft.insights/datacollectionendpoints':     { label: 'Data Collection Endpoint', icon: 'other/01857-icon-service-Data-Collection-Rules.svg' },
  'microsoft.operationalinsights/workspaces':       { label: 'Log Analytics',          icon: 'management + governance/00009-icon-service-Log-Analytics-Workspaces.svg' },
  'microsoft.cache/redis':                          { label: 'Redis Cache',            icon: 'databases/10137-icon-service-Cache-Redis.svg' },
  'microsoft.cache/redisenterprise':                { label: 'Redis Enterprise',       icon: 'new icons/03675-icon-service-Azure-Managed-Redis.svg' },
  'microsoft.cache/redisenterprise/databases':      { label: 'Redis Enterprise DB',    icon: 'new icons/03675-icon-service-Azure-Managed-Redis.svg' },
  'microsoft.appconfiguration/configurationstores': { label: 'App Configuration',      icon: 'integration/10219-icon-service-App-Configuration.svg' },
  'microsoft.recoveryservices/vaults':              { label: 'Recovery Services Vault', icon: 'storage/00017-icon-service-Recovery-Services-Vaults.svg' },
  'microsoft.documentdb/databaseaccounts':          { label: 'Cosmos DB',              icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/sqldatabases': { label: 'Cosmos SQL DB',     icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/mongodbdatabases': { label: 'Cosmos Mongo DB', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/cassandrakeyspaces': { label: 'Cosmos Cassandra', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/gremlindatabases': { label: 'Cosmos Gremlin DB', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/tables':   { label: 'Cosmos Table',           icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.apimanagement/service':                { label: 'API Management',         icon: 'integration/10042-icon-service-API-Management-Services.svg' },
  'microsoft.logic/workflows':                      { label: 'Logic App',              icon: 'integration/02631-icon-service-Logic-Apps.svg' },
  'microsoft.web/connections':                      { label: 'Connection',             icon: 'web/10048-icon-service-API-Connections.svg' },
  'microsoft.portal/dashboards':                    { label: 'Dashboard',              icon: 'general/10015-icon-service-Dashboard.svg' },
  'microsoft.compute/virtualmachines/extensions':   { label: 'VM Extension',           icon: 'general/10799-icon-service-Extensions.svg' },
  'microsoft.hybridcompute/machines/extensions':    { label: 'Machine Extension',      icon: 'general/10799-icon-service-Extensions.svg' },
  'microsoft.automation/schedules':                 { label: 'Automation Schedule',    icon: 'general/10833-icon-service-Scheduler.svg' },
  'microsoft.devtestlab/schedules':                 { label: 'Schedule',               icon: 'general/10833-icon-service-Scheduler.svg' },
  'microsoft.resources/subscriptions':              { label: 'Subscription',           icon: 'general/10002-icon-service-Subscriptions.svg' },
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

  getResourceTypeCatalog(): { type: string; label: string; iconUrl: string; category: string }[] {
    return Object.entries(RESOURCE_TYPE_MAP).map(([type, meta]) => {
      const category = meta.icon.split('/')[0];
      return { type, label: meta.label, iconUrl: this.getIconUrl(type), category };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  private humanizeType(type: string): string {
    const parts = type.split('/');
    const last = parts[parts.length - 1];
    return last.replace(/([A-Z])/g, ' $1').trim();
  }
}
