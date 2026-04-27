const { Router } = require('express');
const { getArmToken, azErrorBody } = require('../lib/az-cli');
const { httpsPost } = require('../lib/arm-client');
const { log } = require('../lib/logger');

const router = Router();

router.post('/cost', async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });
  try {
    const token = await getArmToken();
    const body = JSON.stringify({
      type: 'ActualCost',
      timeframe: 'MonthToDate',
      dataset: {
        granularity: 'None',
        grouping: [{ type: 'Dimension', name: 'ResourceId' }],
        aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
      },
    });
    const result = await httpsPost(
      'management.azure.com',
      `/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
      { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
      body
    );
    const rows = result.properties?.rows ?? [];
    const cols = result.properties?.columns?.map(c => c.name) ?? [];
    const costIdx = cols.indexOf('Cost');
    const idIdx   = cols.indexOf('ResourceId');
    const curIdx  = cols.indexOf('Currency');

    const resources = rows.map(row => ({
      resourceId: row[idIdx] ?? '',
      costUsd: parseFloat(row[costIdx] ?? 0),
      currency: row[curIdx] ?? 'USD',
      billingPeriod: 'Month to Date',
    }));

    const byRg = {}, byType = {};
    let total = 0;
    for (const r of resources) {
      total += r.costUsd;
      const parts = r.resourceId.split('/');
      const rg   = parts[4] ?? 'unknown';
      const type = `${parts[6]}/${parts[7]}` ?? 'unknown';
      byRg[rg]     = (byRg[rg]     ?? 0) + r.costUsd;
      byType[type] = (byType[type] ?? 0) + r.costUsd;
    }
    log('info', `Cost query: $${total.toFixed(2)} across ${resources.length} resources for sub ${subscriptionId}`);
    res.json({ totalUsd: total, currency: 'USD', byResourceGroup: byRg, byResourceType: byType, resources });
  } catch (err) {
    log('error', `Cost query failed (sub ${subscriptionId}):`, err.message);
    const raw = err.azRaw ?? err.message ?? '';
    const status = (err.httpStatus === 403 || raw.includes('403')) ? 403 : 500;
    res.status(status).json(azErrorBody(raw));
  }
});

module.exports = router;
