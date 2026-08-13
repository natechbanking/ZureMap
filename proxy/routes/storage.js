const { Router } = require('express');
const { getArmToken, azErrorBody } = require('../lib/az-cli');
const { httpsGet } = require('../lib/arm-client');
const { log } = require('../lib/logger');

const router = Router();

router.get('/storage-details', async (req, res) => {
  const { accountId } = req.query;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const accountName = accountId.split('/').pop();
  log('debug', `Storage details requested for ${accountName}`);
  try {
    const token = await getArmToken();
    const authHeader = { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' };
    const base = accountId.replace(/\/$/, '');

    const safeGet = async (path) => {
      try {
        return await httpsGet(path, authHeader);
      } catch (err) {
        log('warn', `Storage sub-resource fetch failed (${path.split('/').slice(-3, -1).join('/')}):`, err.message);
        return { value: [] };
      }
    };

    const [containers, shares, tables, queues] = await Promise.all([
      safeGet(`${base}/blobServices/default/containers?api-version=2023-05-01`),
      safeGet(`${base}/fileServices/default/shares?api-version=2023-05-01`),
      safeGet(`${base}/tableServices/default/tables?api-version=2023-05-01`),
      safeGet(`${base}/queueServices/default/queues?api-version=2023-05-01`),
    ]);

    const result = {
      containers: (containers.value ?? []).map(c => c.name),
      fileShares:  (shares.value    ?? []).map(s => s.name),
      tables:      (tables.value    ?? []).map(t => t.name),
      queues:      (queues.value    ?? []).map(q => q.name),
    };
    const total = result.containers.length + result.fileShares.length + result.tables.length + result.queues.length;
    log('info', `Storage details for ${accountName}: ${total} items (${result.containers.length}c ${result.fileShares.length}s ${result.tables.length}t ${result.queues.length}q)`);
    res.json(result);
  } catch (err) {
    log('error', `Storage details failed for ${accountName}:`, err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

module.exports = router;
