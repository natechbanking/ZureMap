import {
  mapAksInfo,
  mapVmInfo,
  mapRouteEntries,
  mapSubnetEntries,
  mapNsgRuleEntries,
} from './diagram-node-list-details.mapper';

describe('diagram-node-list-details.mapper', () => {

  // ── mapAksInfo ───────────────────────────────────────────────────────────────

  describe('mapAksInfo', () => {
    it('extracts kubernetesVersion', () => {
      const result = mapAksInfo({ kubernetesVersion: '1.29.2' });
      expect(result.kubernetesVersion).toBe('1.29.2');
    });

    it('falls back to "Unknown" when kubernetesVersion is absent', () => {
      expect(mapAksInfo({}).kubernetesVersion).toBe('Unknown');
    });

    it('extracts networkPlugin from networkProfile', () => {
      const result = mapAksInfo({ networkProfile: { networkPlugin: 'azure' } });
      expect(result.networkPlugin).toBe('azure');
    });

    it('falls back to "Unknown" when networkProfile is absent', () => {
      expect(mapAksInfo({}).networkPlugin).toBe('Unknown');
    });

    it('maps agentPoolProfiles to nodePools', () => {
      const result = mapAksInfo({
        agentPoolProfiles: [
          { name: 'system', count: 3, vmSize: 'Standard_D4s_v3', mode: 'System', osType: 'Linux' },
        ],
      });
      expect(result.nodePools.length).toBe(1);
      expect(result.nodePools[0].name).toBe('system');
      expect(result.nodePools[0].count).toBe(3);
      expect(result.nodePools[0].vmSize).toBe('Standard_D4s_v3');
    });

    it('returns empty nodePools when agentPoolProfiles is absent', () => {
      expect(mapAksInfo({}).nodePools).toEqual([]);
    });

    it('fills nodePool defaults for missing fields', () => {
      const [pool] = mapAksInfo({ agentPoolProfiles: [{}] }).nodePools;
      expect(pool.name).toBe('unnamed');
      expect(pool.count).toBe(0);
      expect(pool.vmSize).toBe('Unknown');
      expect(pool.mode).toBe('User');
      expect(pool.osType).toBe('Linux');
    });
  });

  // ── mapVmInfo ────────────────────────────────────────────────────────────────

  describe('mapVmInfo', () => {
    it('extracts vmSize from hardwareProfile', () => {
      const result = mapVmInfo({ hardwareProfile: { vmSize: 'Standard_B2s' } });
      expect(result.vmSize).toBe('Standard_B2s');
    });

    it('falls back to "Unknown" when hardwareProfile is absent', () => {
      expect(mapVmInfo({}).vmSize).toBe('Unknown');
    });

    it('extracts osType from storageProfile.osDisk', () => {
      const result = mapVmInfo({ storageProfile: { osDisk: { osType: 'Windows' } } });
      expect(result.osType).toBe('Windows');
    });

    it('extracts imageOffer and imageSku from imageReference', () => {
      const result = mapVmInfo({
        storageProfile: { imageReference: { offer: 'UbuntuServer', sku: '20_04-lts' } },
      });
      expect(result.imageOffer).toBe('UbuntuServer');
      expect(result.imageSku).toBe('20_04-lts');
    });

    it('extracts adminUsername and computerName from osProfile', () => {
      const result = mapVmInfo({ osProfile: { adminUsername: 'azureuser', computerName: 'my-vm' } });
      expect(result.adminUsername).toBe('azureuser');
      expect(result.computerName).toBe('my-vm');
    });

    it('returns null for adminUsername and computerName when osProfile is absent', () => {
      const result = mapVmInfo({});
      expect(result.adminUsername).toBeNull();
      expect(result.computerName).toBeNull();
    });
  });

  // ── mapRouteEntries ──────────────────────────────────────────────────────────

  describe('mapRouteEntries', () => {
    it('returns empty array when routes property is absent', () => {
      expect(mapRouteEntries({})).toEqual([]);
    });

    it('maps route fields to RouteEntryView', () => {
      const [entry] = mapRouteEntries({
        routes: [{
          name: 'rt1',
          properties: { addressPrefix: '10.0.0.0/8', nextHopType: 'VirtualAppliance', nextHopIpAddress: '10.1.0.4' },
        }],
      });
      expect(entry.name).toBe('rt1');
      expect(entry.addressPrefix).toBe('10.0.0.0/8');
      expect(entry.nextHopType).toBe('VirtualAppliance');
      expect(entry.nextHopIpAddress).toBe('10.1.0.4');
    });

    it('applies fallback defaults for missing route fields', () => {
      const [entry] = mapRouteEntries({ routes: [{}] });
      expect(entry.name).toBe('Unnamed route');
      expect(entry.addressPrefix).toBe('N/A');
      expect(entry.nextHopType).toBe('Unknown');
      expect(entry.nextHopIpAddress).toBeNull();
    });
  });

  // ── mapSubnetEntries ─────────────────────────────────────────────────────────

  describe('mapSubnetEntries', () => {
    it('returns empty array when subnets property is absent', () => {
      expect(mapSubnetEntries({})).toEqual([]);
    });

    it('maps subnet name and addressPrefix', () => {
      const [entry] = mapSubnetEntries({
        subnets: [{ name: 'sn1', properties: { addressPrefix: '10.0.1.0/24' } }],
      });
      expect(entry.name).toBe('sn1');
      expect(entry.addressPrefix).toBe('10.0.1.0/24');
    });

    it('applies fallback defaults for missing subnet fields', () => {
      const [entry] = mapSubnetEntries({ subnets: [{}] });
      expect(entry.name).toBe('Unnamed subnet');
      expect(entry.addressPrefix).toBe('N/A');
    });
  });

  // ── mapNsgRuleEntries ────────────────────────────────────────────────────────

  describe('mapNsgRuleEntries', () => {
    it('returns empty array when both rule arrays are absent', () => {
      expect(mapNsgRuleEntries({})).toEqual([]);
    });

    it('marks user rules with isDefault = false', () => {
      const [rule] = mapNsgRuleEntries({
        securityRules: [{ name: 'allow-http', properties: { priority: 100 } }],
      });
      expect(rule.isDefault).toBeFalse();
    });

    it('marks default rules with isDefault = true', () => {
      const [rule] = mapNsgRuleEntries({
        defaultSecurityRules: [{ name: 'AllowVnetInBound', properties: { priority: 65000 } }],
      });
      expect(rule.isDefault).toBeTrue();
    });

    it('merges user and default rules into a single sorted array', () => {
      const rules = mapNsgRuleEntries({
        securityRules: [{ name: 'custom', properties: { priority: 200 } }],
        defaultSecurityRules: [{ name: 'default-high', properties: { priority: 65000 } }],
      });
      expect(rules.length).toBe(2);
      expect(rules[0].priority).toBeLessThan(rules[1].priority);
    });

    it('sorts all rules by priority ascending', () => {
      const rules = mapNsgRuleEntries({
        securityRules: [
          { name: 'r300', properties: { priority: 300 } },
          { name: 'r100', properties: { priority: 100 } },
        ],
        defaultSecurityRules: [{ name: 'r200', properties: { priority: 200 } }],
      });
      expect(rules.map(r => r.priority)).toEqual([100, 200, 300]);
    });

    it('applies fallback values for missing rule properties', () => {
      const [rule] = mapNsgRuleEntries({ securityRules: [{}] });
      expect(rule.name).toBe('Unnamed rule');
      expect(rule.direction).toBe('Inbound');
      expect(rule.access).toBe('Allow');
      expect(rule.protocol).toBe('*');
    });
  });
});
