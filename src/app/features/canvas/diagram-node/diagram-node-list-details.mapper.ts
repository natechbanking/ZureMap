export interface AksNodePoolView {
  name: string;
  count: number;
  vmSize: string;
  mode: string;
  osType: string;
}

export interface AksInfoView {
  kubernetesVersion: string;
  networkPlugin: string;
  nodePools: AksNodePoolView[];
}

export interface VmInfoView {
  vmSize: string;
  osType: string;
  imageOffer: string;
  imageSku: string;
  adminUsername: string | null;
  computerName: string | null;
}

export interface RouteEntryView {
  name: string;
  addressPrefix: string;
  nextHopType: string;
  nextHopIpAddress: string | null;
}

export interface SubnetEntryView {
  name: string;
  addressPrefix: string;
}

export interface NsgRuleView {
  name: string;
  direction: string;
  priority: number;
  access: string;
  protocol: string;
  sourceAddressPrefix: string;
  destinationPortRange: string;
  isDefault: boolean;
}

export function mapAksInfo(properties: Record<string, unknown>): AksInfoView {
  const pools = (properties['agentPoolProfiles'] as {
    name?: string;
    count?: number;
    vmSize?: string;
    mode?: string;
    osType?: string;
  }[] | undefined) ?? [];
  const netProfile = properties['networkProfile'] as { networkPlugin?: string } | undefined;
  return {
    kubernetesVersion: (properties['kubernetesVersion'] as string | undefined) ?? 'Unknown',
    networkPlugin: netProfile?.networkPlugin ?? 'Unknown',
    nodePools: pools.map(p => ({
      name: p.name ?? 'unnamed',
      count: p.count ?? 0,
      vmSize: p.vmSize ?? 'Unknown',
      mode: p.mode ?? 'User',
      osType: p.osType ?? 'Linux',
    })),
  };
}

export function mapVmInfo(properties: Record<string, unknown>): VmInfoView {
  const hw = properties['hardwareProfile'] as { vmSize?: string } | undefined;
  const storage = properties['storageProfile'] as {
    osDisk?: { osType?: string };
    imageReference?: { offer?: string; sku?: string };
  } | undefined;
  const os = properties['osProfile'] as { computerName?: string; adminUsername?: string } | undefined;
  return {
    vmSize: hw?.vmSize ?? 'Unknown',
    osType: storage?.osDisk?.osType ?? 'Unknown',
    imageOffer: storage?.imageReference?.offer ?? '',
    imageSku: storage?.imageReference?.sku ?? '',
    adminUsername: os?.adminUsername ?? null,
    computerName: os?.computerName ?? null,
  };
}

export function mapRouteEntries(properties: Record<string, unknown>): RouteEntryView[] {
  const routes = (properties['routes'] as unknown[] | undefined) ?? [];
  return routes.map(raw => {
    const route = raw as {
      name?: string;
      properties?: { addressPrefix?: string; nextHopType?: string; nextHopIpAddress?: string };
    };
    return {
      name: route.name ?? 'Unnamed route',
      addressPrefix: route.properties?.addressPrefix ?? 'N/A',
      nextHopType: route.properties?.nextHopType ?? 'Unknown',
      nextHopIpAddress: route.properties?.nextHopIpAddress ?? null,
    };
  });
}

export function mapSubnetEntries(properties: Record<string, unknown>): SubnetEntryView[] {
  const subnets = (properties['subnets'] as unknown[] | undefined) ?? [];
  return subnets.map(raw => {
    const subnet = raw as { name?: string; properties?: { addressPrefix?: string } };
    return {
      name: subnet.name ?? 'Unnamed subnet',
      addressPrefix: subnet.properties?.addressPrefix ?? 'N/A',
    };
  });
}

export function mapNsgRuleEntries(properties: Record<string, unknown>): NsgRuleView[] {
  const userRules = (properties['securityRules'] as unknown[] | undefined) ?? [];
  const defaultRules = (properties['defaultSecurityRules'] as unknown[] | undefined) ?? [];
  const toView = (raw: unknown, isDefault: boolean): NsgRuleView => {
    const rule = raw as {
      name?: string;
      properties?: {
        direction?: string;
        priority?: number;
        access?: string;
        protocol?: string;
        sourceAddressPrefix?: string;
        destinationPortRange?: string;
      };
    };
    return {
      name: rule.name ?? 'Unnamed rule',
      direction: rule.properties?.direction ?? 'Inbound',
      priority: rule.properties?.priority ?? 0,
      access: rule.properties?.access ?? 'Allow',
      protocol: rule.properties?.protocol ?? '*',
      sourceAddressPrefix: rule.properties?.sourceAddressPrefix ?? '*',
      destinationPortRange: rule.properties?.destinationPortRange ?? '*',
      isDefault,
    };
  };

  return [...userRules.map(r => toView(r, false)), ...defaultRules.map(r => toView(r, true))]
    .sort((a, b) => a.priority - b.priority);
}
