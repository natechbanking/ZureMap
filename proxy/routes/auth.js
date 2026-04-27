const { Router } = require('express');
const { runAz, azErrorBody } = require('../lib/az-cli');
const { log } = require('../lib/logger');

const router = Router();

router.get('/login-status', async (req, res) => {
  try {
    const account = await runAz(['account', 'show', '--output', 'json']);
    log('info', `Login status: signed in as ${account.user?.name ?? account.name} (${account.tenantId})`);
    res.json({ loggedIn: true, account });
  } catch {
    log('debug', 'Login status: not signed in');
    res.json({ loggedIn: false });
  }
});

router.post('/login', async (req, res) => {
  try {
    await runAz(['login', '--output', 'json']);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

router.get('/subscriptions', async (req, res) => {
  try {
    const [subs, tenants, restTenants] = await Promise.all([
      runAz(['account', 'list', '--output', 'json']).catch(() => []),
      runAz(['account', 'tenant', 'list', '--output', 'json']).catch(() => []),
      runAz(['rest', '--method', 'GET', '--url', 'https://management.azure.com/tenants?api-version=2022-12-01', '--output', 'json']).catch(() => null),
    ]);

    const tenantMap = new Map();
    if (Array.isArray(tenants)) {
      for (const t of tenants) {
        if (t.tenantId && t.displayName) tenantMap.set(t.tenantId, t.displayName);
      }
    }
    if (Array.isArray(restTenants?.value)) {
      for (const t of restTenants.value) {
        if (t.tenantId && t.displayName && !tenantMap.has(t.tenantId)) {
          tenantMap.set(t.tenantId, t.displayName);
        }
      }
    }

    const normalized = (Array.isArray(subs) ? subs : []).map(s => ({
      id: s.id,
      subscriptionId: s.id,
      name: s.name,
      state: s.state,
      tenantId: s.tenantId,
      tenantName: tenantMap.get(s.tenantId) || s.tenantId,
    }));
    log('info', `Subscriptions: returned ${normalized.length}`);
    res.json(normalized);
  } catch (err) {
    log('error', 'Subscriptions fetch failed:', err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

router.get('/token', async (req, res) => {
  const resource = req.query.resource || 'https://management.azure.com/';
  try {
    const token = await runAz(['account', 'get-access-token', '--resource', resource, '--output', 'json']);
    res.json(token);
  } catch (err) {
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

module.exports = router;
