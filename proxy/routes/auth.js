const { spawn } = require('child_process');
const { Router } = require('express');
const { runAz, azErrorBody } = require('../lib/az-cli');
const { log } = require('../lib/logger');

const DEVICE_CODE_TIMEOUT_MS = 5 * 60 * 1000;

const router = Router();
let deviceCodeLogin = null; // { promise, child, timer }

function parseDeviceCodePrompt(text) {
  const urlMatch = text.match(/https?:\/\/\S{1,2000}/i);
  const codeMatch = text.match(/enter the code[ \t]{1,10}([A-Z0-9-]{1,64})/i);
  if (!urlMatch || !codeMatch) return null;
  return {
    verificationUrl: urlMatch[0].replace(/[.)\]]{1,10}$/, ''),
    userCode: codeMatch[1],
    message: text.trim(),
  };
}

function cancelDeviceCodeLogin() {
  if (!deviceCodeLogin) return;
  clearTimeout(deviceCodeLogin.timer);
  deviceCodeLogin.child?.kill();
  deviceCodeLogin = null;
}

function startDeviceCodeLogin(force = false) {
  if (deviceCodeLogin && !force) return deviceCodeLogin.promise;

  cancelDeviceCodeLogin();

  const entry = { child: null, timer: null, promise: null };
  deviceCodeLogin = entry;

  entry.promise = new Promise((resolve, reject) => {
    const child = spawn('az', ['login', '--use-device-code'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    entry.child = child;

    entry.timer = setTimeout(() => {
      log('warn', 'Device code login timed out after 5 minutes');
      if (deviceCodeLogin === entry) deviceCodeLogin = null;
      child.kill();
      reject(Object.assign(new Error('Device code login timed out'), { azRaw: 'Login timed out after 5 minutes' }));
    }, DEVICE_CODE_TIMEOUT_MS);

    let output = '';
    let settled = false;

    const onChunk = (chunk) => {
      output += chunk.toString();
      const prompt = parseDeviceCodePrompt(output);
      if (!settled && prompt) {
        settled = true;
        resolve(prompt);
      }
    };

    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);

    child.on('error', (err) => {
      clearTimeout(entry.timer);
      if (deviceCodeLogin === entry) deviceCodeLogin = null;
      if (!settled) {
        settled = true;
        reject(Object.assign(err, { azRaw: output || err.message }));
      }
    });

    child.on('exit', (code) => {
      clearTimeout(entry.timer);
      if (deviceCodeLogin === entry) deviceCodeLogin = null;
      if (code === 0) {
        log('info', 'Device code login completed successfully');
      } else {
        log('warn', `Device code login exited with code ${code}`);
      }
      if (!settled) {
        settled = true;
        reject(Object.assign(new Error(output || `az login exited with code ${code}`), {
          azRaw: output || `az login exited with code ${code}`,
        }));
      }
    });
  });

  return entry.promise;
}

router.get('/login-status', async (req, res) => {
  try {
    const account = await runAz(['account', 'show', '--output', 'json']);
    await runAz(['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json']);
    log('info', `Login status: signed in as ${account.user?.name ?? account.name} (${account.tenantId})`);
    res.json({ loggedIn: true, account });
  } catch (err) {
    const detail = azErrorBody(err.azRaw ?? err.message);
    log('debug', `Login status: not ready (${detail.code})`);
    res.json({ loggedIn: false, ...detail });
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

router.post('/login-device-code', async (req, res) => {
  try {
    const force = req.body?.force === true;
    const prompt = await startDeviceCodeLogin(force);
    log('info', `Device code login started for ${prompt.verificationUrl}${force ? ' (forced)' : ''}`);
    res.json(prompt);
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
