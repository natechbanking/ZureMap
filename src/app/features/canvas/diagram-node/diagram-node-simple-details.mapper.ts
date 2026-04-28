import { DetailKv, getPath, pickListText, pickText, toArrayCount, toArrayCountText, toBoolText, toCsvCount, toDisplayText, toNumber, toNumberStat, toTextStat, toTitleLabel } from './diagram-node-format.util';

export function mapHostingEnvironmentStats(properties: Record<string, unknown>): DetailKv[] {
  const workerPools = (properties['workerPools'] as {
    workerCount?: number | string;
    instanceCount?: number | string;
    numberOfWorkers?: number | string;
  }[] | undefined) ?? [];

  const totalWorkers = workerPools.reduce((sum, pool) => {
    const workers = toNumber(pool.workerCount) ?? toNumber(pool.instanceCount) ?? toNumber(pool.numberOfWorkers) ?? 0;
    return sum + workers;
  }, 0);

  return [
    { label: 'Worker Pools', value: workerPools.length.toString() },
    { label: 'Worker Instances', value: totalWorkers.toString() },
    toNumberStat('Front-End Scale', toNumber(properties['frontEndScaleFactor'])),
    toNumberStat('Dedicated Hosts', toNumber(properties['dedicatedHostCount'])),
    toNumberStat('Cluster Settings', toArrayCount(properties['clusterSettings'])),
    toNumberStat('Outbound IPs', toCsvCount(properties['outboundIpAddresses'])),
    toNumberStat('IP SSL Addresses', toNumber(properties['ipsslAddressCount'])),
    toNumberStat('Internal LB Modes', toCsvCount(properties['internalLoadBalancingMode'])),
  ].filter((x): x is DetailKv => !!x);
}

export function mapServerFarmStats(properties: Record<string, unknown>, sku: { name?: string; tier?: string; capacity?: unknown } | undefined): DetailKv[] {
  return [
    toTextStat('SKU', sku?.name ?? null),
    toTextStat('Tier', sku?.tier ?? null),
    toNumberStat('Capacity', toNumber(sku?.capacity)),
    toNumberStat('Workers', toNumber(properties['numberOfWorkers'])),
    toNumberStat('Sites', toNumber(properties['numberOfSites'])),
    toNumberStat('Maximum Elastic Workers', toNumber(properties['maximumElasticWorkerCount'])),
    toTextStat('Zone Redundant', toBoolText(properties['zoneRedundant'])),
    toTextStat('Reserved (Linux)', toBoolText(properties['reserved'])),
    toTextStat('Hyper-V', toBoolText(properties['hyperV'])),
    toTextStat('Per-Site Scaling', toBoolText(properties['perSiteScaling'])),
  ].filter((x): x is DetailKv => !!x);
}

export function mapPublicIpDetails(properties: Record<string, unknown>, sku: { name?: string; tier?: string } | undefined): DetailKv[] {
  const dns = properties['dnsSettings'] as { fqdn?: string; domainNameLabel?: string } | undefined;
  const ipTags = (properties['ipTags'] as { ipTagType?: string; tag?: string }[] | undefined) ?? [];
  const ipTagSummary = ipTags.length > 0
    ? ipTags.map(t => [t.ipTagType, t.tag].filter(Boolean).join(':')).filter(Boolean).join(', ')
    : null;

  return [
    toTextStat('IP Address', (properties['ipAddress'] as string | undefined) ?? null),
    toTextStat('Allocation', (properties['publicIPAllocationMethod'] as string | undefined) ?? null),
    toTextStat('Version', (properties['publicIPAddressVersion'] as string | undefined) ?? null),
    toTextStat('FQDN', dns?.fqdn ?? null),
    toTextStat('DNS Label', dns?.domainNameLabel ?? null),
    toTextStat('SKU', sku?.name ?? null),
    toTextStat('Tier', sku?.tier ?? null),
    toNumberStat('Idle Timeout (min)', toNumber(properties['idleTimeoutInMinutes'])),
    toTextStat('IP Tags', ipTagSummary),
  ].filter((x): x is DetailKv => !!x);
}

export function mapScheduleDetails(
  metadata: { name?: unknown; type?: unknown; location?: unknown; resourceGroup?: unknown; subscriptionId?: unknown },
  properties: Record<string, unknown>,
): DetailKv[] {
  const details: DetailKv[] = [];
  const add = (label: string, value: string | null): void => {
    if (!value) return;
    if (details.some(d => d.label === label && d.value === value)) return;
    details.push({ label, value });
  };

  const advanced = (getPath(properties, 'advancedSchedule') as {
    weekDays?: unknown[];
    monthDays?: unknown[];
    monthlyOccurrences?: { day?: unknown; occurrence?: unknown }[];
  } | undefined) ?? {};

  const monthlyOccurrences = (advanced.monthlyOccurrences ?? [])
    .map(item => [toDisplayText(item.day), toDisplayText(item.occurrence)].filter((v): v is string => !!v).join(' #'))
    .filter(Boolean)
    .join(', ');

  add('State', pickText(properties, ['state', 'status']));
  add('Task Type', pickText(properties, ['taskType']));
  add('Frequency', pickText(properties, ['frequency', 'dailyRecurrence.time']));
  add('Interval', pickText(properties, ['interval', 'hourlyRecurrence.interval']));
  add('Time Zone', pickText(properties, ['timeZone', 'timeZoneId']));
  add('Start Time', pickText(properties, ['startTime', 'creationTime']));
  add('Expiry Time', pickText(properties, ['expiryTime']));
  add('Next Run', pickText(properties, ['nextRun', 'nextExecutionTime']));
  add('Notification Time', pickText(properties, ['notificationSettings.timeInMinutes']));
  add('Week Days', pickListText(properties, ['advancedSchedule.weekDays', 'weeklyRecurrence.weekDays']));
  add('Month Days', pickListText(properties, ['advancedSchedule.monthDays']));
  add('Monthly Occurrences', monthlyOccurrences || null);
  add('Target Resource ID', pickText(properties, ['targetResourceId']));
  add('Provisioning State', pickText(properties, ['provisioningState']));

  if (details.length === 0) {
    add('Name', toDisplayText(metadata.name));
    add('Type', toDisplayText(metadata.type));
    add('Location', toDisplayText(metadata.location));
    add('Resource Group', toDisplayText(metadata.resourceGroup));
    add('Subscription', toDisplayText(metadata.subscriptionId));

    const scalarEntries = Object.entries(properties)
      .filter(([_, value]) => toDisplayText(value))
      .slice(0, 6);
    for (const [key, value] of scalarEntries) {
      add(toTitleLabel(key), toDisplayText(value));
    }
  }

  return details;
}

export function mapDiskDetails(properties: Record<string, unknown>, sku: { name?: string; tier?: string } | undefined): DetailKv[] {
  const encryption = (properties['encryption'] as { type?: string; diskEncryptionSetId?: string } | undefined) ?? {};
  return [
    toTextStat('State', pickText(properties, ['diskState', 'provisioningState'])),
    toTextStat('OS Type', pickText(properties, ['osType'])),
    toTextStat('Create Option', pickText(properties, ['creationData.createOption'])),
    toTextStat('Size (GiB)', pickText(properties, ['diskSizeGB'])),
    toTextStat('Performance Tier', pickText(properties, ['tier'])),
    toTextStat('IOPS', pickText(properties, ['diskIOPSReadWrite'])),
    toTextStat('Throughput (MBps)', pickText(properties, ['diskMBpsReadWrite'])),
    toTextStat('SKU', sku?.name ?? null),
    toTextStat('Tier', sku?.tier ?? null),
    toTextStat('Network Access', pickText(properties, ['networkAccessPolicy'])),
    toTextStat('Public Network Access', pickText(properties, ['publicNetworkAccess'])),
    toTextStat('Bursting Enabled', toBoolText(properties['burstingEnabled'])),
    toTextStat('Max Shares', pickText(properties, ['maxShares'])),
    toTextStat('Hyper-V Generation', pickText(properties, ['hyperVGeneration'])),
    toTextStat('Encryption Type', toDisplayText(encryption.type)),
    toTextStat('Disk Encryption Set', toDisplayText(encryption.diskEncryptionSetId)),
    toTextStat('Source Resource ID', pickText(properties, ['creationData.sourceResourceId'])),
  ].filter((x): x is DetailKv => !!x);
}

export function mapAzureFirewallDetails(
  properties: Record<string, unknown>,
  sku: { name?: string; tier?: string } | undefined,
  counts: { applicationRules: number | null; networkRules: number | null; natRules: number | null },
): DetailKv[] {
  return [
    toTextStat('Provisioning State', pickText(properties, ['provisioningState'])),
    toTextStat('Operational State', pickText(properties, ['operationalState'])),
    toTextStat('Threat Intel Mode', pickText(properties, ['threatIntelMode'])),
    toTextStat('Firewall Policy', pickText(properties, ['firewallPolicy.id'])),
    toTextStat('Management IP Config', pickText(properties, ['managementIpConfiguration.name'])),
    toTextStat('IP Config Count', toArrayCountText(properties['ipConfigurations'])),
    toTextStat('Public IP Count', toArrayCountText(properties['publicIpAddresses'])),
    toTextStat('Private Range Count', toArrayCountText(properties['privateRanges'])),
    toTextStat('Application Rules', counts.applicationRules === null ? null : counts.applicationRules.toString()),
    toTextStat('Network Rules', counts.networkRules === null ? null : counts.networkRules.toString()),
    toTextStat('NAT Rules', counts.natRules === null ? null : counts.natRules.toString()),
    toTextStat('Additional Properties', toArrayCountText(properties['additionalProperties'])),
    toTextStat('SKU', sku?.name ?? null),
    toTextStat('Tier', sku?.tier ?? null),
  ].filter((x): x is DetailKv => !!x);
}

export function mapApplicationGatewayDetails(properties: Record<string, unknown>, sku: { name?: string; tier?: string; capacity?: unknown } | undefined): DetailKv[] {
  const autoscale = (properties['autoscaleConfiguration'] as {
    minCapacity?: number | string;
    maxCapacity?: number | string;
  } | undefined) ?? {};

  return [
    toTextStat('Provisioning State', pickText(properties, ['provisioningState'])),
    toTextStat('Operational State', pickText(properties, ['operationalState'])),
    toTextStat('SKU', sku?.name ?? null),
    toTextStat('Tier', sku?.tier ?? null),
    toTextStat('Capacity', pickText(properties, ['sku.capacity']) ?? toDisplayText(sku?.capacity)),
    toTextStat('Autoscale Min', toDisplayText(autoscale.minCapacity)),
    toTextStat('Autoscale Max', toDisplayText(autoscale.maxCapacity)),
    toTextStat('Gateway IP Configs', toArrayCountText(properties['gatewayIPConfigurations'])),
    toTextStat('Frontend IP Configs', toArrayCountText(properties['frontendIPConfigurations'])),
    toTextStat('Frontend Ports', toArrayCountText(properties['frontendPorts'])),
    toTextStat('HTTP Listeners', toArrayCountText(properties['httpListeners'])),
    toTextStat('Backend Pools', toArrayCountText(properties['backendAddressPools'])),
    toTextStat('Backend HTTP Settings', toArrayCountText(properties['backendHttpSettingsCollection'])),
    toTextStat('Routing Rules', toArrayCountText(properties['requestRoutingRules'])),
    toTextStat('URL Path Maps', toArrayCountText(properties['urlPathMaps'])),
    toTextStat('Probes', toArrayCountText(properties['probes'])),
    toTextStat('SSL Certificates', toArrayCountText(properties['sslCertificates'])),
    toTextStat('Trusted Root Certs', toArrayCountText(properties['trustedRootCertificates'])),
    toTextStat('Rewrite Rule Sets', toArrayCountText(properties['rewriteRuleSets'])),
    toTextStat('Web Application Firewall', pickText(properties, ['webApplicationFirewallConfiguration.enabled'])),
  ].filter((x): x is DetailKv => !!x);
}

export function mapConnectionDetails(properties: Record<string, unknown>): DetailKv[] {
  return [
    toTextStat('Connection Type', pickText(properties, ['connectionType'])),
    toTextStat('Connection Protocol', pickText(properties, ['connectionProtocol'])),
    toTextStat('Provisioning State', pickText(properties, ['provisioningState'])),
    toTextStat('Connection Status', pickText(properties, ['connectionStatus'])),
    toTextStat('Egress Bytes', pickText(properties, ['egressBytesTransferred'])),
    toTextStat('Ingress Bytes', pickText(properties, ['ingressBytesTransferred'])),
    toTextStat('Authorization Key', pickText(properties, ['authorizationKey'])),
    toTextStat('Enable BGP', toBoolText(properties['enableBgp'])),
    toTextStat('Use Policy-Based Selectors', toBoolText(properties['usePolicyBasedTrafficSelectors'])),
    toTextStat('Routing Weight', pickText(properties, ['routingWeight'])),
    toTextStat('ExpressRoute Gateway Bypass', toBoolText(properties['expressRouteGatewayBypass'])),
    toTextStat('DPD Timeout (s)', pickText(properties, ['dpdTimeoutSeconds'])),
    toTextStat('IPSec Policies', toArrayCountText(properties['ipsecPolicies'])),
    toTextStat('Traffic Selector Policies', toArrayCountText(properties['trafficSelectorPolicies'])),
    toTextStat('Shared Key (set)', toDisplayText(properties['sharedKey']) ? 'Yes' : null),
    toTextStat('Virtual Network Gateway 1', pickText(properties, ['virtualNetworkGateway1.id'])),
    toTextStat('Virtual Network Gateway 2', pickText(properties, ['virtualNetworkGateway2.id'])),
    toTextStat('Local Network Gateway 2', pickText(properties, ['localNetworkGateway2.id'])),
    toTextStat('Peer', pickText(properties, ['peer.id'])),
  ].filter((x): x is DetailKv => !!x);
}
