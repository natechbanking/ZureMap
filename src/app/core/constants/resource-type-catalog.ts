export type ResourceCatalogSource = 'curated' | 'manifest' | 'discovered';

export interface ResourceCatalogMetadata {
  label: string;
  icon: string;
  category?: string;
}

export interface HybridResourceCatalogEntry {
  type: string;
  label: string;
  iconUrl: string;
  category: string;
  source: ResourceCatalogSource;
}

export const RESOURCE_TYPE_MAP: Record<string, ResourceCatalogMetadata> = {
  'microsoft.compute/virtualmachines': { label: 'Virtual Machine', icon: 'compute/10021-icon-service-Virtual-Machine.svg' },
  'microsoft.compute/disks': { label: 'Managed Disk', icon: 'compute/10032-icon-service-Disks.svg' },
  'microsoft.compute/snapshots': { label: 'Disk Snapshot', icon: 'compute/10026-icon-service-Disks-Snapshots.svg' },
  'microsoft.compute/virtualmachinescalesets': { label: 'VM Scale Set', icon: 'compute/10034-icon-service-VM-Scale-Sets.svg' },
  'microsoft.compute/availabilitysets': { label: 'Availability Set', icon: 'compute/10025-icon-service-Availability-Sets.svg' },
  'microsoft.compute/images': { label: 'Image', icon: 'compute/10033-icon-service-Images.svg' },
  'microsoft.compute/galleries': { label: 'Gallery', icon: 'compute/10039-icon-service-Shared-Image-Galleries.svg' },
  'microsoft.compute/galleries/images': { label: 'Gallery Image', icon: 'compute/10033-icon-service-Images.svg' },
  'microsoft.compute/galleries/images/versions': { label: 'Image Version', icon: 'compute/10038-icon-service-Image-Versions.svg' },
  'microsoft.compute/restorepointcollections': { label: 'Restore Point Collection', icon: 'compute/02818-icon-service-Restore-Points-Collections.svg' },
  'microsoft.compute/hostgroups': { label: 'Host Group', icon: 'compute/10346-icon-service-Host-Groups.svg' },
  'microsoft.compute/hosts': { label: 'Dedicated Host', icon: 'compute/10347-icon-service-Hosts.svg' },

  'microsoft.network/virtualnetworks': { label: 'Virtual Network', icon: 'networking/10061-icon-service-Virtual-Networks.svg' },
  'microsoft.network/subnets': { label: 'Subnet', icon: 'networking/02742-icon-service-Subnet.svg' },
  'microsoft.network/networksecuritygroups': { label: 'NSG', icon: 'networking/10067-icon-service-Network-Security-Groups.svg' },
  'microsoft.network/privateendpoints': { label: 'Private Endpoint', icon: 'other/02579-icon-service-Private-Endpoints.svg' },
  'microsoft.network/publicipaddresses': { label: 'Public IP', icon: 'networking/10069-icon-service-Public-IP-Addresses.svg' },
  'microsoft.network/publicipprefixes': { label: 'Public IP Prefix', icon: 'networking/10372-icon-service-Public-IP-Prefixes.svg' },
  'microsoft.network/loadbalancers': { label: 'Load Balancer', icon: 'networking/10062-icon-service-Load-Balancers.svg' },
  'microsoft.network/applicationgateways': { label: 'Application Gateway', icon: 'networking/10076-icon-service-Application-Gateways.svg' },
  'microsoft.network/networkinterfaces': { label: 'Network Interface', icon: 'networking/10080-icon-service-Network-Interfaces.svg' },
  'microsoft.network/connections': { label: 'Connection', icon: 'networking/10081-icon-service-Connections.svg' },
  'microsoft.network/virtualnetworkgateways': { label: 'Virtual Network Gateway', icon: 'networking/10063-icon-service-Virtual-Network-Gateways.svg' },
  'microsoft.network/localnetworkgateways': { label: 'Local Network Gateway', icon: 'networking/10077-icon-service-Local-Network-Gateways.svg' },
  'microsoft.network/firewallpolicies': { label: 'Firewall Policy', icon: 'networking/00272-icon-service-Azure-Firewall-Policy.svg' },
  'microsoft.network/azurefirewalls': { label: 'Azure Firewall', icon: 'networking/10084-icon-service-Firewalls.svg' },
  'microsoft.network/bastionhosts': { label: 'Bastion Host', icon: 'networking/02422-icon-service-Bastions.svg' },
  'microsoft.network/privatelinkservices': { label: 'Private Link Service', icon: 'networking/02209-icon-service-Private-Link-Services.svg' },
  'microsoft.network/privatednszones': { label: 'Private DNS Zone', icon: 'networking/10064-icon-service-DNS-Zones.svg' },
  'microsoft.network/dnsresolvers': { label: 'DNS Resolver', icon: 'networking/02882-icon-service-DNS-Private-Resolver.svg' },
  'microsoft.network/expressroutecircuits': { label: 'ExpressRoute Circuit', icon: 'networking/10079-icon-service-ExpressRoute-Circuits.svg' },
  'microsoft.network/routefilters': { label: 'Route Filter', icon: 'networking/10071-icon-service-Route-Filters.svg' },
  'microsoft.network/routetables': { label: 'Route Table', icon: 'networking/10082-icon-service-Route-Tables.svg' },
  'microsoft.network/routetables/routes': { label: 'Route', icon: 'networking/10082-icon-service-Route-Tables.svg' },
  'microsoft.network/frontdoors': { label: 'Front Door', icon: 'networking/10073-icon-service-Front-Door-and-CDN-Profiles.svg' },
  'microsoft.network/networkwatchers': { label: 'Network Watcher', icon: 'networking/10066-icon-service-Network-Watcher.svg' },
  'microsoft.network/dnszones': { label: 'DNS Zone', icon: 'networking/10064-icon-service-DNS-Zones.svg' },

  'microsoft.storage/storageaccounts': { label: 'Storage Account', icon: 'storage/10086-icon-service-Storage-Accounts.svg' },
  'microsoft.storage/storageaccounts/blobservices/containers': { label: 'Blob Container', icon: 'general/10839-icon-service-Storage-Container.svg' },
  'microsoft.storage/storageaccounts/fileservices/shares': { label: 'File Share', icon: 'storage/10400-icon-service-Azure-Fileshares.svg' },
  'microsoft.storage/storageaccounts/queueservices/queues': { label: 'Queue', icon: 'general/10840-icon-service-Storage-Queue.svg' },
  'microsoft.storage/storageaccounts/tableservices/tables': { label: 'Table', icon: 'general/10841-icon-service-Table.svg' },
  'microsoft.storage/storageaccounts/objectreplicationpolicies': { label: 'Object Replication Policy', icon: 'storage/10086-icon-service-Storage-Accounts.svg' },

  'microsoft.web/sites': { label: 'App Service', icon: 'app services/10035-icon-service-App-Services.svg' },
  'microsoft.web/sites/slots': { label: 'App Service Slot', icon: 'app services/10035-icon-service-App-Services.svg' },
  'microsoft.web/serverfarms': { label: 'App Service Plan', icon: 'app services/00046-icon-service-App-Service-Plans.svg' },
  'microsoft.web/hostingenvironments': { label: 'App Service Environment', icon: 'app services/10047-icon-service-App-Service-Environments.svg' },
  'microsoft.web/staticsites': { label: 'Static Web App', icon: 'web/01007-icon-service-Static-Apps.svg' },
  'microsoft.web/certificates': { label: 'Certificate', icon: 'app services/00049-icon-service-App-Service-Certificates.svg' },
  'microsoft.web/connections': { label: 'API Connection', icon: 'web/10048-icon-service-API-Connections.svg' },

  'microsoft.sql/servers': { label: 'SQL Server', icon: 'databases/10132-icon-service-SQL-Server.svg' },
  'microsoft.sql/servers/databases': { label: 'SQL Database', icon: 'databases/10130-icon-service-SQL-Database.svg' },
  'microsoft.sql/managedinstances': { label: 'SQL Managed Instance', icon: 'databases/10136-icon-service-SQL-Managed-Instance.svg' },
  'microsoft.sql/managedinstances/databases': { label: 'Managed Instance DB', icon: 'databases/10135-icon-service-Managed-Database.svg' },
  'microsoft.sql/virtualclusters': { label: 'Virtual Cluster', icon: 'databases/10127-icon-service-Virtual-Clusters.svg' },
  'microsoft.dbforpostgresql/flexibleservers': { label: 'PostgreSQL Flexible Server', icon: 'databases/10131-icon-service-Azure-Database-PostgreSQL-Server.svg' },
  'microsoft.dbformysql/flexibleservers': { label: 'MySQL Flexible Server', icon: 'databases/10122-icon-service-Azure-Database-MySQL-Server.svg' },
  'microsoft.dbformariadb/servers': { label: 'MariaDB Server', icon: 'databases/10123-icon-service-Azure-Database-MariaDB-Server.svg' },

  'microsoft.documentdb/databaseaccounts': { label: 'Cosmos DB Account', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/sqldatabases': { label: 'Cosmos SQL DB', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/mongodbdatabases': { label: 'Cosmos Mongo DB', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },
  'microsoft.documentdb/databaseaccounts/cassandrakeyspaces': { label: 'Cosmos Cassandra', icon: 'databases/10121-icon-service-Azure-Cosmos-DB.svg' },

  'microsoft.servicebus/namespaces': { label: 'Service Bus Namespace', icon: 'integration/10836-icon-service-Azure-Service-Bus.svg' },
  'microsoft.eventhub/namespaces': { label: 'Event Hubs Namespace', icon: 'analytics/00039-icon-service-Event-Hubs.svg' },
  'microsoft.eventhub/clusters': { label: 'Event Hubs Cluster', icon: 'analytics/10149-icon-service-Event-Hub-Clusters.svg' },
  'microsoft.eventgrid/topics': { label: 'Event Grid Topic', icon: 'integration/10221-icon-service-Event-Grid-Subscriptions.svg' },

  'microsoft.containerservice/managedclusters': { label: 'AKS Cluster', icon: 'compute/10023-icon-service-Kubernetes-Services.svg' },
  'microsoft.containerregistry/registries': { label: 'Container Registry', icon: 'containers/10105-icon-service-Container-Registries.svg' },
  'microsoft.containerinstance/containergroups': { label: 'Container Instance', icon: 'compute/10104-icon-service-Container-Instances.svg' },
  'microsoft.app/managedenvironments': { label: 'Container Apps Environment', icon: 'other/02989-icon-service-Container-Apps-Environments.svg' },
  'microsoft.app/containerapps': { label: 'Container App', icon: 'other/02884-icon-service-Worker-Container-App.svg' },
  'microsoft.app/jobs': { label: 'Container App Job', icon: 'other/10846-icon-service-Web-Jobs.svg' },

  'microsoft.keyvault/vaults': { label: 'Key Vault', icon: 'security/10245-icon-service-Key-Vaults.svg' },
  'microsoft.managedidentity/userassignedidentities': { label: 'User Assigned Identity', icon: 'identity/10230-icon-service-Users.svg' },

  'microsoft.cache/redis': { label: 'Redis Cache', icon: 'databases/10137-icon-service-Cache-Redis.svg' },
  'microsoft.cache/redisenterprise': { label: 'Redis Enterprise', icon: 'new icons/03675-icon-service-Azure-Managed-Redis.svg' },
  'microsoft.cache/redisenterprise/databases': { label: 'Redis Enterprise DB', icon: 'new icons/03675-icon-service-Azure-Managed-Redis.svg' },

  'microsoft.apimanagement/service': { label: 'API Management', icon: 'integration/10042-icon-service-API-Management-Services.svg' },
  'microsoft.logic/workflows': { label: 'Logic App', icon: 'integration/02631-icon-service-Logic-Apps.svg' },
  'microsoft.appconfiguration/configurationstores': { label: 'App Configuration', icon: 'integration/10219-icon-service-App-Configuration.svg' },

  'microsoft.insights/components': { label: 'Application Insights', icon: 'management + governance/00012-icon-service-Application-Insights.svg' },
  'microsoft.insights/workbooks': { label: 'Workbook', icon: 'monitor/02189-icon-service-Azure-Workbooks.svg' },
  'microsoft.insights/actiongroups': { label: 'Action Group', icon: 'monitor/00001-icon-service-Monitor.svg' },
  'microsoft.insights/datacollectionrules': { label: 'Data Collection Rule', icon: 'other/01857-icon-service-Data-Collection-Rules.svg' },
  'microsoft.operationalinsights/workspaces': { label: 'Log Analytics Workspace', icon: 'management + governance/00009-icon-service-Log-Analytics-Workspaces.svg' },

  'microsoft.recoveryservices/vaults': { label: 'Recovery Services Vault', icon: 'storage/00017-icon-service-Recovery-Services-Vaults.svg' },
  'microsoft.automation/automationaccounts': { label: 'Automation Account', icon: 'management + governance/00022-icon-service-Automation-Accounts.svg' },
  'microsoft.automation/schedules': { label: 'Automation Schedule', icon: 'general/10833-icon-service-Scheduler.svg' },

  'microsoft.resources/subscriptions': { label: 'Subscription', icon: 'general/10002-icon-service-Subscriptions.svg' },
  'microsoft.resources/resourcegroups': { label: 'Resource Group', icon: 'general/10007-icon-service-Resource-Groups.svg' },

  'kubernetes/namespace': { label: 'K8s Namespace', icon: 'containers/10023-icon-service-Kubernetes-Services.svg', category: 'kubernetes' },
  'kubernetes/cluster': { label: 'K8s Cluster', icon: 'containers/10023-icon-service-Kubernetes-Services.svg', category: 'kubernetes' },
  'kubernetes/deployment': { label: 'K8s Deployment', icon: 'containers/10023-icon-service-Kubernetes-Services.svg', category: 'kubernetes' },
  'kubernetes/service': { label: 'K8s Service', icon: 'containers/10023-icon-service-Kubernetes-Services.svg', category: 'kubernetes' },
  'kubernetes/pod': { label: 'K8s Pod', icon: 'containers/10023-icon-service-Kubernetes-Services.svg', category: 'kubernetes' },
};
