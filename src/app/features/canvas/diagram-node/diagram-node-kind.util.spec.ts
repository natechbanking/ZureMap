import { isAks, isDisk, isRouteTable, isSchedule, isStorageAccount } from './diagram-node-kind.util';

describe('diagram-node-kind.util', () => {
  it('detects route tables case-insensitively', () => {
    expect(isRouteTable('Microsoft.Network/routeTables')).toBeTrue();
    expect(isRouteTable('microsoft.network/virtualNetworks')).toBeFalse();
  });

  it('detects schedule variants', () => {
    expect(isSchedule('Microsoft.Automation/schedules')).toBeTrue();
    expect(isSchedule('Microsoft.DevTestLab/schedules')).toBeTrue();
    expect(isSchedule('Microsoft.Compute/disks')).toBeFalse();
  });

  it('detects common resource kinds', () => {
    expect(isStorageAccount('microsoft.storage/storageaccounts')).toBeTrue();
    expect(isAks('microsoft.containerservice/managedclusters')).toBeTrue();
    expect(isDisk('microsoft.compute/disks')).toBeTrue();
  });
});
