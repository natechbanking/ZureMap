export function isRouteTable(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/routetables';
}

export function isVirtualNetwork(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/virtualnetworks';
}

export function isNsg(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/networksecuritygroups';
}

export function isStorageAccount(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.storage/storageaccounts';
}

export function isAks(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.containerservice/managedclusters';
}

export function isVm(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.compute/virtualmachines';
}

export function isUserAssignedIdentity(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.managedidentity/userassignedidentities';
}

export function isHostingEnvironment(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.web/hostingenvironments';
}

export function isServerFarm(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.web/serverfarms';
}

export function isPublicIpAddress(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/publicipaddresses';
}

export function isSchedule(resourceType: string): boolean {
  const type = normalizeType(resourceType);
  return type === 'microsoft.automation/schedules' || type === 'microsoft.devtestlab/schedules';
}

export function isDisk(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.compute/disks';
}

export function isAzureFirewall(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/azurefirewalls';
}

export function isApplicationGateway(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/applicationgateways';
}

export function isConnectionResource(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/connections';
}

export function isDnsZone(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/dnszones';
}

export function isPrivateDnsZone(resourceType: string): boolean {
  return normalizeType(resourceType) === 'microsoft.network/privatednszones';
}

export function isDnsZoneKind(resourceType: string): boolean {
  return isDnsZone(resourceType) || isPrivateDnsZone(resourceType);
}

function normalizeType(resourceType: string): string {
  return resourceType.toLowerCase();
}
