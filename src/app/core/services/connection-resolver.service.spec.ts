import { ConnectionResolverService } from './connection-resolver.service';
import { AzureResource } from '../models/azure-resource.model';
import { DiagramNode } from '../models/diagram-node.model';

function res(id: string, type: string, overrides: Partial<AzureResource> = {}): AzureResource {
  return {
    id,
    name: id.split('/').pop() ?? 'name',
    type,
    location: 'westeurope',
    resourceGroup: 'rg1',
    subscriptionId: 'sub1',
    tags: {},
    properties: {},
    ...overrides,
  };
}

function node(id: string): DiagramNode {
  return {
    id,
    label: id.split('/').pop() ?? 'node',
    resourceType: '',
    iconUrl: '',
    group: 'resourceGroup',
    groupId: 'rg1',
    position: { x: 0, y: 0 },
    size: { width: 140, height: 92 },
    status: 'unknown',
    metadata: {} as AzureResource,
    selected: false,
    highlighted: false,
  };
}

const SUB = '/subscriptions/sub1/resourceGroups/rg1/providers';
const ENDPOINT_ID = `${SUB}/Microsoft.Network/privateEndpoints/ep1`;
const SERVICE_ID  = `${SUB}/Microsoft.Storage/storageAccounts/sa1`;
const VNET_A      = `${SUB}/Microsoft.Network/virtualNetworks/vnetA`;
const VNET_B      = `${SUB}/Microsoft.Network/virtualNetworks/vnetB`;
const UAI_ID      = `${SUB}/Microsoft.ManagedIdentity/userAssignedIdentities/uai1`;
const VM_ID       = `${SUB}/Microsoft.Compute/virtualMachines/vm1`;
const NIC_ID      = `${SUB}/Microsoft.Network/networkInterfaces/nic1`;
const NSG_ID      = `${SUB}/Microsoft.Network/networkSecurityGroups/nsg1`;

describe('ConnectionResolverService', () => {
  let svc: ConnectionResolverService;
  beforeEach(() => { svc = new ConnectionResolverService(); });

  // ── resolvePrivateLinkConnections ────────────────────────────────────────────

  describe('resolvePrivateLinkConnections', () => {
    it('creates a privateLink edge when target is in the node set', () => {
      const endpoint = res(ENDPOINT_ID, 'Microsoft.Network/privateEndpoints', {
        properties: { privateLinkServiceConnections: [{ properties: { privateLinkServiceId: SERVICE_ID } }] },
      });
      const edges = svc.resolvePrivateLinkConnections([endpoint], [node(ENDPOINT_ID), node(SERVICE_ID)]);
      expect(edges.length).toBe(1);
      expect(edges[0].sourceId).toBe(ENDPOINT_ID);
      expect(edges[0].targetId).toBe(SERVICE_ID);
      expect(edges[0].edgeType).toBe('privateLink');
      expect(edges[0].animated).toBeTrue();
    });

    it('skips the edge when the target is not in the node set', () => {
      const endpoint = res(ENDPOINT_ID, 'Microsoft.Network/privateEndpoints', {
        properties: { privateLinkServiceConnections: [{ properties: { privateLinkServiceId: SERVICE_ID } }] },
      });
      const edges = svc.resolvePrivateLinkConnections([endpoint], [node(ENDPOINT_ID)]);
      expect(edges.length).toBe(0);
    });

    it('ignores non-private-endpoint resources', () => {
      const vm = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        properties: { privateLinkServiceConnections: [{ properties: { privateLinkServiceId: SERVICE_ID } }] },
      });
      const edges = svc.resolvePrivateLinkConnections([vm], [node(VM_ID), node(SERVICE_ID)]);
      expect(edges.length).toBe(0);
    });
  });

  // ── resolveVNetPeering ───────────────────────────────────────────────────────

  describe('resolveVNetPeering', () => {
    function vnetWithPeer(id: string, peerId: string) {
      return res(id, 'Microsoft.Network/virtualNetworks', {
        properties: { virtualNetworkPeerings: [{ properties: { remoteVirtualNetwork: { id: peerId } } }] },
      });
    }

    it('creates a vnetPeering edge', () => {
      const edges = svc.resolveVNetPeering(
        [vnetWithPeer(VNET_A, VNET_B)],
        [node(VNET_A), node(VNET_B)],
      );
      expect(edges.length).toBe(1);
      expect(edges[0].edgeType).toBe('vnetPeering');
    });

    it('deduplicates bidirectional peering entries into one edge', () => {
      const resources = [vnetWithPeer(VNET_A, VNET_B), vnetWithPeer(VNET_B, VNET_A)];
      const edges = svc.resolveVNetPeering(resources, [node(VNET_A), node(VNET_B)]);
      expect(edges.length).toBe(1);
    });

    it('skips peering when the remote VNet is not in the node set', () => {
      const edges = svc.resolveVNetPeering(
        [vnetWithPeer(VNET_A, VNET_B)],
        [node(VNET_A)],
      );
      expect(edges.length).toBe(0);
    });
  });

  // ── resolveManagedIdentityEdges ──────────────────────────────────────────────

  describe('resolveManagedIdentityEdges', () => {
    it('creates a managedIdentity edge from UAI to the assigned resource', () => {
      const vm = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        identity: { type: 'UserAssigned', userAssignedIdentities: { [UAI_ID]: {} } },
      });
      const edges = svc.resolveManagedIdentityEdges([vm], [node(VM_ID), node(UAI_ID)]);
      expect(edges.length).toBe(1);
      expect(edges[0].sourceId).toBe(UAI_ID);
      expect(edges[0].targetId).toBe(VM_ID);
      expect(edges[0].edgeType).toBe('managedIdentity');
    });

    it('deduplicates identical UAI→resource assignments', () => {
      const vm1 = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        identity: { userAssignedIdentities: { [UAI_ID]: {} } },
      });
      const vm2 = res(VM_ID + 'dup', 'Microsoft.Compute/virtualMachines', {
        identity: { userAssignedIdentities: { [UAI_ID]: {} } },
      });
      const vm2Node = node(VM_ID + 'dup');
      const edges = svc.resolveManagedIdentityEdges([vm1, vm2], [node(VM_ID), vm2Node, node(UAI_ID)]);
      const uniqueKeys = new Set(edges.map(e => `${e.sourceId}|${e.targetId}`));
      expect(uniqueKeys.size).toBe(edges.length);
    });

    it('skips the edge when the UAI is not in the node set', () => {
      const vm = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        identity: { userAssignedIdentities: { [UAI_ID]: {} } },
      });
      const edges = svc.resolveManagedIdentityEdges([vm], [node(VM_ID)]);
      expect(edges.length).toBe(0);
    });

    it('skips resources without a userAssignedIdentities block', () => {
      const vm = res(VM_ID, 'Microsoft.Compute/virtualMachines');
      const edges = svc.resolveManagedIdentityEdges([vm], [node(VM_ID), node(UAI_ID)]);
      expect(edges.length).toBe(0);
    });
  });

  // ── resolveNsgAssociations ───────────────────────────────────────────────────

  describe('resolveNsgAssociations', () => {
    it('creates nsgAssociation edge for a NIC linked to an NSG', () => {
      const nic = res(NIC_ID, 'Microsoft.Network/networkInterfaces', {
        properties: { networkSecurityGroup: { id: NSG_ID } },
      });
      const edges = svc.resolveNsgAssociations([nic], [node(NIC_ID), node(NSG_ID)]);
      expect(edges.length).toBe(1);
      expect(edges[0].edgeType).toBe('nsgAssociation');
      expect(edges[0].sourceId).toBe(NIC_ID);
      expect(edges[0].targetId).toBe(NSG_ID);
    });

    it('skips NIC→NSG edge when NSG is not in the node set', () => {
      const nic = res(NIC_ID, 'Microsoft.Network/networkInterfaces', {
        properties: { networkSecurityGroup: { id: NSG_ID } },
      });
      const edges = svc.resolveNsgAssociations([nic], [node(NIC_ID)]);
      expect(edges.length).toBe(0);
    });
  });

  // ── resolveAll ───────────────────────────────────────────────────────────────

  describe('resolveAll', () => {
    it('omits managed identity edges when option is not set', () => {
      const vm = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        identity: { userAssignedIdentities: { [UAI_ID]: {} } },
      });
      const edges = svc.resolveAll([vm], [node(VM_ID), node(UAI_ID)]);
      expect(edges.some(e => e.edgeType === 'managedIdentity')).toBeFalse();
    });

    it('includes managed identity edges when userAssignedIdentities option is true', () => {
      const vm = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        identity: { userAssignedIdentities: { [UAI_ID]: {} } },
      });
      const edges = svc.resolveAll([vm], [node(VM_ID), node(UAI_ID)], { userAssignedIdentities: true });
      expect(edges.some(e => e.edgeType === 'managedIdentity')).toBeTrue();
    });
  });
});
