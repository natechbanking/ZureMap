const { spawn } = require('child_process');
const { Router } = require('express');
const { runAz, azErrorBody } = require('../lib/az-cli');
const { log } = require('../lib/logger');

const router = Router();
let deviceCodeLogin = null;

function parseDeviceCodePrompt(text) {
  const urlMatch = text.match(/https?:\/\/\S+/i);
  const codeMatch = text.match(/enter the code\s+([A-Z0-9-]+)/i);
  if (!urlMatch || !codeMatch) return null;
  return {
    verificationUrl: urlMatch[0].replace(/[.)\]]+$/, ''),
    userCode: codeMatch[1],
    message: text.trim(),
  };
}

function startDeviceCodeLogin() {
  if (deviceCodeLogin) return deviceCodeLogin.promise;

  deviceCodeLogin = {};
  deviceCodeLogin.promise = new Promise((resolve, reject) => {
    const child = spawn('az', ['login', '--use-device-code'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

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
      if (!settled) {
        settled = true;
        reject(Object.assign(err, { azRaw: output || err.message }));
      }
      deviceCodeLogin = null;
    });

    child.on('exit', (code) => {
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
      deviceCodeLogin = null;
    });
  });

  return deviceCodeLogin.promise;
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

router.post('/login-device-code', async (_req, res) => {
  try {
    const prompt = await startDeviceCodeLogin();
    log('info', `Device code login started for ${prompt.verificationUrl}`);
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
