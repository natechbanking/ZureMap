import { mapConnectionDetails, mapPublicIpDetails, mapScheduleDetails } from './diagram-node-simple-details.mapper';

describe('diagram-node-simple-details.mapper', () => {
  it('maps public IP details with dns and tags', () => {
    const details = mapPublicIpDetails(
      {
        ipAddress: '1.2.3.4',
        publicIPAllocationMethod: 'Static',
        dnsSettings: { fqdn: 'x.example.com' },
        ipTags: [{ ipTagType: 'First', tag: 'TagA' }],
      },
      { name: 'Standard', tier: 'Regional' },
    );

    expect(details.some(d => d.label === 'IP Address' && d.value === '1.2.3.4')).toBeTrue();
    expect(details.some(d => d.label === 'FQDN' && d.value === 'x.example.com')).toBeTrue();
    expect(details.some(d => d.label === 'IP Tags' && d.value.includes('First:TagA'))).toBeTrue();
  });

  it('maps schedule fallback when schedule fields are absent', () => {
    const details = mapScheduleDetails(
      { name: 'sched-a', type: 'custom/schedule', location: 'westeurope', resourceGroup: 'rg1', subscriptionId: 'sub1' },
      { arbitraryValue: 'abc' },
    );

    expect(details.some(d => d.label === 'Name' && d.value === 'sched-a')).toBeTrue();
    expect(details.some(d => d.label === 'Arbitrary Value' && d.value === 'abc')).toBeTrue();
  });

  it('maps connection details with bools and counters', () => {
    const details = mapConnectionDetails({
      connectionType: 'IPsec',
      enableBgp: true,
      ipsecPolicies: [{}, {}],
      sharedKey: 'secret',
    });

    expect(details.some(d => d.label === 'Connection Type' && d.value === 'IPsec')).toBeTrue();
    expect(details.some(d => d.label === 'Enable BGP' && d.value === 'Yes')).toBeTrue();
    expect(details.some(d => d.label === 'IPSec Policies' && d.value === '2')).toBeTrue();
    expect(details.some(d => d.label === 'Shared Key (set)' && d.value === 'Yes')).toBeTrue();
  });
});
