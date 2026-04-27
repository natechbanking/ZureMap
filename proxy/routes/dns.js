const { Router } = require('express');
const { getArmToken, azErrorBody } = require('../lib/az-cli');
const { httpsGet } = require('../lib/arm-client');
const { log } = require('../lib/logger');

const router = Router();

const RECORD_TYPE_KEYS = {
  ARecords:      'A',
  AaaaRecords:   'AAAA',
  CnameRecord:   'CNAME',
  MxRecords:     'MX',
  NsRecords:     'NS',
  PtrRecords:    'PTR',
  SoaRecord:     'SOA',
  SrvRecords:    'SRV',
  TxtRecords:    'TXT',
  CaaRecords:    'CAA',
};

function extractRecordValues(properties) {
  for (const [key, type] of Object.entries(RECORD_TYPE_KEYS)) {
    const val = properties[key];
    if (!val) continue;
    if (Array.isArray(val)) {
      return { type, values: val.map(r => r.ipv4Address ?? r.ipv6Address ?? r.nsdname ?? r.ptrdname ?? r.value ?? r.exchange ?? r.target ?? JSON.stringify(r)).filter(Boolean) };
    }
    if (typeof val === 'object') {
      return { type, values: [val.value ?? val.fqdn ?? JSON.stringify(val)].filter(Boolean) };
    }
  }
  return { type: 'UNKNOWN', values: [] };
}

router.get('/dns-zone-records', async (req, res) => {
  const zoneId = String(req.query.zoneId ?? '').trim();
  if (!zoneId) return res.status(400).json({ error: 'zoneId required' });

  const isPrivate = zoneId.toLowerCase().includes('/privatednszones/');
  const apiVersion = isPrivate ? '2020-06-01' : '2018-05-01';
  const zoneName = zoneId.split('/').pop();
  log('debug', `DNS zone records requested for ${zoneName} (${isPrivate ? 'private' : 'public'})`);

  try {
    const token = await getArmToken();
    const authHeader = { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' };
    const base = zoneId.replace(/\/$/, '');

    const result = await httpsGet(
      'management.azure.com',
      `${base}/recordsets?api-version=${apiVersion}&$top=500`,
      authHeader,
    );

    const records = (result.value ?? []).map(rs => {
      const { type, values } = extractRecordValues(rs.properties ?? {});
      return {
        name: rs.name ?? '@',
        type,
        ttl: rs.properties?.ttl ?? rs.properties?.TTL ?? null,
        values,
      };
    });

    log('info', `DNS zone records for ${zoneName}: ${records.length} record set(s)`);
    res.json({ records });
  } catch (err) {
    log('error', `DNS zone records failed for ${zoneName}:`, err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

module.exports = router;
