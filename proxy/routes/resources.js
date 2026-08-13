const { Router } = require('express');
const { getArmToken, azErrorBody } = require('../lib/az-cli');
const { httpsPost } = require('../lib/arm-client');
const { log } = require('../lib/logger');

const router = Router();

router.post('/query', async (req, res) => {
  const { query, subscriptions, $skipToken } = req.body;
  if (!query || !subscriptions?.length) {
    return res.status(400).json({ error: 'query and subscriptions required' });
  }
  try {
    const token = await getArmToken();
    const options = { resultFormat: 'objectArray' };
    if ($skipToken) options.$skipToken = $skipToken;
    const body = JSON.stringify({ query, subscriptions, options });
    log('debug', `Resource Graph query across ${subscriptions.length} sub(s)${$skipToken ? ' [paged]' : ''}`);
    const result = await httpsPost(
      '/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01',
      { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      body
    );
    log('debug', `Resource Graph: ${result.data?.length ?? 0} rows returned`);
    res.json({ data: result.data ?? [], $skipToken: result.$skipToken });
  } catch (err) {
    log('error', 'Resource Graph query failed:', err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

router.get('/scan-stream', async (req, res) => {
  const subscriptionIds = (req.query.subscriptionIds || '').split(',').filter(Boolean);
  if (!subscriptionIds.length) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const token = await getArmToken();
    const kql = `Resources | project id, name, type, location, resourceGroup, subscriptionId, tags, properties, sku, kind | order by type asc`;
    log('info', `Scan stream started for ${subscriptionIds.length} subscription(s)`);
    let skipToken;
    let totalRows = 0;
    do {
      const body = JSON.stringify({
        query: kql,
        subscriptions: subscriptionIds,
        options: { $skipToken: skipToken, resultFormat: 'objectArray' },
      });
      const result = await httpsPost(
        '/providers/Microsoft.ResourceGraph/resources?api-version=2024-04-01',
        { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
        body
      );
      const batch = result.data ?? [];
      totalRows += batch.length;
      if (batch.length > 0) {
        log('debug', `Scan stream batch: ${batch.length} resources (${totalRows} total so far)`);
        res.write(`data: ${JSON.stringify(batch)}\n\n`);
      }
      skipToken = result.$skipToken;
    } while (skipToken);

    log('info', `Scan stream complete: ${totalRows} total resources`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    log('error', 'Scan stream error:', err.message);
    res.write(`data: ${JSON.stringify(azErrorBody(err.azRaw ?? err.message))}\n\n`);
    res.end();
  }
});

module.exports = router;
