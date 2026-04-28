import { ResourceMapperService } from './resource-mapper.service';
import { AzureResource } from '../models/azure-resource.model';

const mockIcons = { getIconUrl: (_type: string) => 'icon.svg' };

function res(
  id: string,
  type: string,
  overrides: Partial<AzureResource> = {}
): AzureResource {
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

const VM_ID   = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1';
const NIC_ID  = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Network/networkInterfaces/nic1';
const DISK_ID = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/disks/disk1';
const SA_ID   = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Storage/storageAccounts/sa1';
const VNET_ID = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Network/virtualNetworks/vnet1';
const SQL_SRV = '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Sql/servers/sql1';
const SQL_DB  = `${SQL_SRV}/databases/db1`;

describe('ResourceMapperService', () => {
  let svc: ResourceMapperService;
  beforeEach(() => { svc = new ResourceMapperService(mockIcons as any); });

  // ── resolveGroup ─────────────────────────────────────────────────────────────

  describe('resolveGroup', () => {
    it('VNet resource → group "vnet", groupId = its own id', () => {
      const { group, groupId } = svc.resolveGroup(res(VNET_ID, 'Microsoft.Network/virtualNetworks'));
      expect(group).toBe('vnet');
      expect(groupId).toBe(VNET_ID);
    });

    it('Subnet resource → group "subnet", groupId = parent VNet id', () => {
      const subnetId = `${VNET_ID}/subnets/sn1`;
      const { group, groupId } = svc.resolveGroup(res(subnetId, 'Microsoft.Network/subnets'));
      expect(group).toBe('subnet');
      expect(groupId).toBe(VNET_ID);
    });

    it('all other resources → group "resourceGroup", groupId = resource group name', () => {
      const { group, groupId } = svc.resolveGroup(res(VM_ID, 'Microsoft.Compute/virtualMachines', { resourceGroup: 'myRg' }));
      expect(group).toBe('resourceGroup');
      expect(groupId).toBe('myRg');
    });

    it('resolveGroup is case-insensitive for type matching', () => {
      const { group } = svc.resolveGroup(res(VNET_ID, 'MICROSOFT.NETWORK/VIRTUALNETWORKS'));
      expect(group).toBe('vnet');
    });
  });

  // ── resolveStatus (via mapResource) ──────────────────────────────────────────

  describe('resolveStatus', () => {
    function statusOf(provisioningState: string) {
      return svc.mapResource(res(VM_ID, 'Microsoft.Compute/virtualMachines', { properties: { provisioningState } })).status;
    }

    it('"Succeeded" → running', () => expect(statusOf('Succeeded')).toBe('running'));
    it('"Failed" → failed',    () => expect(statusOf('Failed')).toBe('failed'));
    it('"Stopped" → stopped',  () => expect(statusOf('Stopped')).toBe('stopped'));
    it('"Deallocated" → stopped', () => expect(statusOf('Deallocated')).toBe('stopped'));
    it('empty string → unknown', () => expect(statusOf('')).toBe('unknown'));
    it('"Updating" → unknown', () => expect(statusOf('Updating')).toBe('unknown'));
  });

  // ── mapResource basics ────────────────────────────────────────────────────────

  describe('mapResource', () => {
    it('maps id, label, resourceType correctly', () => {
      const node = svc.mapResource(res(VM_ID, 'Microsoft.Compute/virtualMachines'));
      expect(node.id).toBe(VM_ID);
      expect(node.label).toBe('vm1');
      expect(node.resourceType).toBe('microsoft.compute/virtualmachines');
    });

    it('sets initial position to (0, 0)', () => {
      const node = svc.mapResource(res(VM_ID, 'Microsoft.Compute/virtualMachines'));
      expect(node.position).toEqual({ x: 0, y: 0 });
    });

    it('selected and highlighted default to false', () => {
      const node = svc.mapResource(res(VM_ID, 'Microsoft.Compute/virtualMachines'));
      expect(node.selected).toBeFalse();
      expect(node.highlighted).toBeFalse();
    });
  });

  // ── VM child grouping (collectVmRelatedResourceIds) ───────────────────────────

  describe('mapResources — VM child grouping', () => {
    it('attaches a referenced NIC to the VM children array', () => {
      const vmResource = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        properties: { networkProfile: { networkInterfaces: [{ id: NIC_ID }] } },
      });
      const nicResource = res(NIC_ID, 'Microsoft.Network/networkInterfaces');
      const nodes = svc.mapResources([vmResource, nicResource]);
      const vmNode = nodes.find(n => n.id === VM_ID)!;
      expect(vmNode.children).toContain(NIC_ID);
    });

    it('attaches OS-disk managed disk to the VM children array', () => {
      const vmResource = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        properties: { storageProfile: { osDisk: { managedDisk: { id: DISK_ID } } } },
      });
      const diskResource = res(DISK_ID, 'Microsoft.Compute/disks');
      const nodes = svc.mapResources([vmResource, diskResource]);
      const vmNode = nodes.find(n => n.id === VM_ID)!;
      expect(vmNode.children).toContain(DISK_ID);
    });

    it('does not add a child from a different subscription', () => {
      const vmResource = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        properties: { networkProfile: { networkInterfaces: [{ id: NIC_ID }] } },
      });
      const nicResource = res(NIC_ID, 'Microsoft.Network/networkInterfaces', { subscriptionId: 'other-sub' });
      const nodes = svc.mapResources([vmResource, nicResource]);
      const vmNode = nodes.find(n => n.id === VM_ID)!;
      expect(vmNode.children ?? []).not.toContain(NIC_ID);
    });

    it('does not claim the same child for two VMs', () => {
      const vm1 = res(VM_ID, 'Microsoft.Compute/virtualMachines', {
        properties: { networkProfile: { networkInterfaces: [{ id: NIC_ID }] } },
      });
      const vm2Id = VM_ID.replace('vm1', 'vm2');
      const vm2 = res(vm2Id, 'Microsoft.Compute/virtualMachines', {
        properties: { networkProfile: { networkInterfaces: [{ id: NIC_ID }] } },
      });
      const nicResource = res(NIC_ID, 'Microsoft.Network/networkInterfaces');
      const nodes = svc.mapResources([vm1, vm2, nicResource]);
      const vm1Children = nodes.find(n => n.id === VM_ID)!.children ?? [];
      const vm2Children = nodes.find(n => n.id === vm2Id)!.children ?? [];
      const nicClaimedTwice = vm1Children.includes(NIC_ID) && vm2Children.includes(NIC_ID);
      expect(nicClaimedTwice).toBeFalse();
    });
  });

  // ── Generic ARM parent/child (resolveImmediateParentId) ──────────────────────

  describe('mapResources — ARM nested-resource parent/child', () => {
    it('sets parentId on a nested ARM resource', () => {
      const nodes = svc.mapResources([
        res(SQL_SRV, 'Microsoft.Sql/servers'),
        res(SQL_DB,  'Microsoft.Sql/servers/databases'),
      ]);
      const dbNode = nodes.find(n => n.id === SQL_DB)!;
      expect(dbNode.parentId).toBe(SQL_SRV);
    });

    it('adds nested resource to parent children array', () => {
      const nodes = svc.mapResources([
        res(SQL_SRV, 'Microsoft.Sql/servers'),
        res(SQL_DB,  'Microsoft.Sql/servers/databases'),
      ]);
      const serverNode = nodes.find(n => n.id === SQL_SRV)!;
      expect(serverNode.children).toContain(SQL_DB);
    });

    it('top-level ARM resource gets no parentId', () => {
      const [node] = svc.mapResources([res(VM_ID, 'Microsoft.Compute/virtualMachines')]);
      expect(node.parentId).toBeUndefined();
    });
  });

  // ── Storage sub-resource absorption ─────────────────────────────────────────

  describe('mapResources — storage sub-resource absorption', () => {
    const CONTAINER_ID = `${SA_ID}/blobServices/default/containers/mycontainer`;

    it('excludes blob container resources from the output nodes', () => {
      const nodes = svc.mapResources([
        res(SA_ID, 'Microsoft.Storage/storageAccounts'),
        res(CONTAINER_ID, 'Microsoft.Storage/storageAccounts/blobServices/containers'),
      ]);
      expect(nodes.find(n => n.id === CONTAINER_ID)).toBeUndefined();
    });

    it('absorbs container name into parent storage account properties', () => {
      const saResource = res(SA_ID, 'Microsoft.Storage/storageAccounts');
      svc.mapResources([
        saResource,
        res(CONTAINER_ID, 'Microsoft.Storage/storageAccounts/blobServices/containers', { name: 'mycontainer' }),
      ]);
      expect((saResource.properties['_blobContainers'] as string[])).toContain('mycontainer');
    });

    it('still includes the storage account node', () => {
      const nodes = svc.mapResources([
        res(SA_ID, 'Microsoft.Storage/storageAccounts'),
        res(CONTAINER_ID, 'Microsoft.Storage/storageAccounts/blobServices/containers'),
      ]);
      expect(nodes.find(n => n.id === SA_ID)).toBeDefined();
    });
  });
});
