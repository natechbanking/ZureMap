const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const https = require('https');

const app = express();
const PORT = 3001;

// ─── Logger ───────────────────────────────────────────────────────────────────

const dim   = s => `\x1b[2m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const red   = s => `\x1b[31m${s}\x1b[0m`;
const cyan  = s => `\x1b[36m${s}\x1b[0m`;

function log(level, msg, ...extra) {
  const ts = new Date().toTimeString().slice(0, 8);
  const prefix = level === 'info'  ? green('[info] ') :
                 level === 'warn'  ? yellow('[warn] ') :
                 level === 'error' ? red('[err]  ') :
                                     dim('[dbg]  ');
  console.log(`${dim(ts)} ${prefix}${msg}`, ...extra);
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const statusColor = res.statusCode >= 500 ? red :
                        res.statusCode >= 400 ? yellow : green;
    log('debug', `${req.method} ${cyan(req.path)} → ${statusColor(res.statusCode)} ${dim(ms + 'ms')}`);
  });
  next();
});

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// In-memory diagram state cache (written by Angular via a POST endpoint)
let currentDiagramState = null;

// Classify raw Azure CLI / network errors into a structured error for the frontend
function classifyAzError(raw = '') {
  const s = raw.toLowerCase();
  if (
    s.includes('nameresolutionerror') ||
    s.includes('failed to resolve') ||
    s.includes('name or service not known') ||
    s.includes('[errno -3]') ||
    s.includes('max retries exceeded')
  ) {
    return { code: 'NO_NETWORK', message: 'Cannot reach Azure — no network connectivity. Check your internet connection and try again.' };
  }
  if (
    s.includes('az login') ||
    s.includes('please run') ||
    s.includes('not logged in') ||
    s.includes('unauthorized_client') ||
    s.includes('aadsts')
  ) {
    return { code: 'AUTH_REQUIRED', message: "Azure CLI authentication required. Please run 'az login' and try again." };
  }
  if (s.includes('timed out') || s.includes('etimedout') || s.includes('timeout')) {
    return { code: 'TIMEOUT', message: 'Request timed out. Azure services may be temporarily unavailable — try again in a moment.' };
  }
  if (s.includes('403') || s.includes('forbidden') || s.includes('authorizationfailed')) {
    return { code: 'PERMISSION_DENIED', message: 'Insufficient permissions to complete this request.' };
  }
  if (s.includes('429') || s.includes('too many requests') || s.includes('throttl')) {
    return { code: 'QUOTA_EXCEEDED', message: 'Azure throttled the request. Wait a few seconds and try again.' };
  }
  return { code: 'SERVER_ERROR', message: 'An unexpected error occurred while communicating with Azure.' };
}

// Build the structured error response body sent to Angular
function azErrorBody(raw) {
  const { code, message } = classifyAzError(raw);
  return { error: message, code, detail: raw.slice(0, 800) }; // cap detail to avoid giant payloads
}

const AZ_TIMEOUT_MS = 60_000; // 60 s for any az CLI call

function runAz(args) {
  return new Promise((resolve, reject) => {
    execFile('az', args, { maxBuffer: 50 * 1024 * 1024, timeout: AZ_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) {
        const raw = stderr || err.message || '';
        return reject(Object.assign(new Error(raw), { azRaw: raw }));
      }
      try { resolve(JSON.parse(stdout)); }
      catch { resolve(stdout.trim()); }
    });
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.get('/api/az/login-status', async (req, res) => {
  try {
    const account = await runAz(['account', 'show', '--output', 'json']);
    log('info', `Login status: signed in as ${account.user?.name ?? account.name} (${account.tenantId})`);
    res.json({ loggedIn: true, account });
  } catch {
    log('debug', 'Login status: not signed in');
    res.json({ loggedIn: false });
  }
});

app.post('/api/az/login', async (req, res) => {
  try {
    await runAz(['login', '--output', 'json']);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

app.get('/api/az/subscriptions', async (req, res) => {
  try {
    const subs = await runAz(['account', 'list', '--output', 'json']);
    const normalized = (Array.isArray(subs) ? subs : []).map(s => ({
      id: s.id,
      subscriptionId: s.id,   // az account list uses "id" for the subscription UUID
      name: s.name,
      state: s.state,
      tenantId: s.tenantId,
    }));
    log('info', `Subscriptions: returned ${normalized.length}`);
    res.json(normalized);
  } catch (err) {
    log('error', 'Subscriptions fetch failed:', err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

app.get('/api/az/token', async (req, res) => {
  const resource = req.query.resource || 'https://management.azure.com/';
  try {
    const token = await runAz(['account', 'get-access-token', '--resource', resource, '--output', 'json']);
    res.json(token);
  } catch (err) {
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

// ─── Resource Graph ───────────────────────────────────────────────────────────

app.post('/api/az/query', async (req, res) => {
  const { query, subscriptions, $skipToken } = req.body;
  if (!query || !subscriptions?.length) {
    return res.status(400).json({ error: 'query and subscriptions required' });
  }
  try {
    const token = await runAz(['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json']);
    const options = { resultFormat: 'objectArray' };
    if ($skipToken) options.$skipToken = $skipToken;
    const body = JSON.stringify({ query, subscriptions, options });
    log('debug', `Resource Graph query across ${subscriptions.length} sub(s)${$skipToken ? ' [paged]' : ''}`);
    const result = await httpsPost(
      'management.azure.com',
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

// ─── SSE Scan Stream ──────────────────────────────────────────────────────────

app.get('/api/az/scan-stream', async (req, res) => {
  const subscriptionIds = (req.query.subscriptionIds || '').split(',').filter(Boolean);
  if (!subscriptionIds.length) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const token = await runAz(['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json']);
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
        'management.azure.com',
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

// ─── Cost Management ─────────────────────────────────────────────────────────

app.post('/api/az/cost', async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });
  try {
    const token = await runAz(['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json']);
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
    // Normalize to SubscriptionCostSummary
    const rows = result.properties?.rows ?? [];
    const cols = result.properties?.columns?.map(c => c.name) ?? [];
    const costIdx = cols.indexOf('Cost');
    const idIdx = cols.indexOf('ResourceId');
    const currencyIdx = cols.indexOf('Currency');

    const resources = rows.map(row => ({
      resourceId: row[idIdx] ?? '',
      costUsd: parseFloat(row[costIdx] ?? 0),
      currency: row[currencyIdx] ?? 'USD',
      billingPeriod: 'Month to Date',
    }));

    const byRg = {};
    const byType = {};
    let total = 0;
    for (const r of resources) {
      total += r.costUsd;
      const parts = r.resourceId.split('/');
      const rg = parts[4] ?? 'unknown';
      const type = `${parts[6]}/${parts[7]}` ?? 'unknown';
      byRg[rg] = (byRg[rg] ?? 0) + r.costUsd;
      byType[type] = (byType[type] ?? 0) + r.costUsd;
    }
    res.json({ totalUsd: total, currency: 'USD', byResourceGroup: byRg, byResourceType: byType, resources });
    log('info', `Cost query: $${total.toFixed(2)} across ${resources.length} resources for sub ${subscriptionId}`);
  } catch (err) {
    log('error', `Cost query failed (sub ${subscriptionId}):`, err.message);
    const raw = err.azRaw ?? err.message ?? '';
    const status = (err.httpStatus === 403 || raw.includes('403')) ? 403 : 500;
    res.status(status).json(azErrorBody(raw));
  }
});

// ─── Storage Account Details ──────────────────────────────────────────────────
// Returns containers, file shares, tables and queues for a given storage account.
// Uses ARM REST via `az rest` to avoid Resource Graph StorageAccountResources availability issues.

app.get('/api/az/storage-details', async (req, res) => {
  const { accountId } = req.query;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const accountName = accountId.split('/').pop();
  log('debug', `Storage details requested for ${accountName}`);
  try {
    const token = await runAz(['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json']);
    const authHeader = { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' };
    const base = accountId.replace(/\/$/, '');

    const safeGet = async (path) => {
      try {
        return await httpsGet('management.azure.com', path, authHeader);
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
      fileShares: (shares.value ?? []).map(s => s.name),
      tables: (tables.value ?? []).map(t => t.name),
      queues: (queues.value ?? []).map(q => q.name),
    };
    const total = result.containers.length + result.fileShares.length + result.tables.length + result.queues.length;
    log('info', `Storage details for ${accountName}: ${total} items (${result.containers.length}c ${result.fileShares.length}s ${result.tables.length}t ${result.queues.length}q)`);
    res.json(result);
  } catch (err) {
    log('error', `Storage details failed for ${accountName}:`, err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

// ─── User Assigned Identity Role Assignments ────────────────────────────────
// Returns RBAC assignments for a user-assigned managed identity principal.

app.get('/api/az/uai-role-assignments', async (req, res) => {
  const principalId = String(req.query.principalId ?? '').trim();
  const subscriptionId = String(req.query.subscriptionId ?? '').trim();
  if (!principalId || !subscriptionId) {
    return res.status(400).json({ error: 'principalId and subscriptionId are required' });
  }

  try {
    const assignments = await runAz([
      'role', 'assignment', 'list',
      '--assignee-object-id', principalId,
      '--subscription', subscriptionId,
      '--include-inherited',
      '--all',
      '--output', 'json',
    ]);

    const normalized = (Array.isArray(assignments) ? assignments : []).map(a => ({
      id: a.id ?? `${a.scope ?? ''}|${a.roleDefinitionName ?? ''}`,
      roleDefinitionName: a.roleDefinitionName ?? 'Unknown role',
      scope: a.scope ?? 'Unknown scope',
      principalType: a.principalType ?? 'Principal',
      description: a.description ?? null,
    }));

    log('info', `UAI role assignments: principal ${principalId} in ${subscriptionId} -> ${normalized.length}`);
    res.json(normalized);
  } catch (err) {
    log('error', `UAI role assignments failed for principal ${principalId}:`, err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

// ─── Diagram State Cache (for MCP) ───────────────────────────────────────────

app.post('/api/diagram/state', (req, res) => {
  currentDiagramState = req.body;
  const nodeCount = req.body?.nodes?.length ?? 0;
  const edgeCount = req.body?.edges?.length ?? 0;
  log('debug', `Diagram state updated: ${nodeCount} nodes, ${edgeCount} edges`);
  res.json({ ok: true });
});

// ─── MCP Endpoint ─────────────────────────────────────────────────────────────

app.get('/api/mcp/diagram-summary', (req, res) => {
  if (!currentDiagramState) {
    return res.status(503).type('text/markdown').send('# ZureMap\nNo diagram loaded yet. Run a scan first.');
  }
  res.type('text/markdown').send(buildMarkdownSummary(currentDiagramState));
});

function buildMarkdownSummary(state) {
  const { nodes = [], edges = [], subscriptions = [], exportedAt } = state;
  const typeCounts = {};
  for (const n of nodes) {
    typeCounts[n.resourceType] = (typeCounts[n.resourceType] ?? 0) + 1;
  }
  const subNames = (subscriptions || []).map(s => s.name).join(', ') || 'Unknown';
  const edgeSummary = edges.map(e => `- ${e.sourceId.split('/').pop()} → ${e.targetId.split('/').pop()} (${e.edgeType})`).slice(0, 20).join('\n');
  const costNodes = nodes.filter(n => n.costData?.monthlyCostUsd > 0)
    .sort((a, b) => b.costData.monthlyCostUsd - a.costData.monthlyCostUsd)
    .slice(0, 5);
  const costSection = costNodes.length
    ? '\n## Top 5 Costs (Month to Date)\n' + costNodes.map((n, i) => `${i + 1}. ${n.label}: $${n.costData.monthlyCostUsd.toFixed(2)}/mo`).join('\n')
    : '';

  return `# ZureMap Diagram Summary
**Subscriptions**: ${subNames}
**Scanned**: ${exportedAt ?? new Date().toISOString()}
**Total nodes**: ${nodes.length} | **Edges**: ${edges.length}

## Resources by Type
| Type | Count |
|---|---|
${Object.entries(typeCounts).map(([t, c]) => `| ${t} | ${c} |`).join('\n')}

## Connections (first 20)
${edgeSummary || 'None'}${costSection}
`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HTTPS_TIMEOUT_MS = 30_000; // 30 s socket timeout for ARM REST calls

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const err = Object.assign(new Error(`HTTP ${res.statusCode}: ${data}`), { httpStatus: res.statusCode, azRaw: data });
          return reject(err);
        }
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.setTimeout(HTTPS_TIMEOUT_MS, () => { req.destroy(Object.assign(new Error('Request timed out'), { azRaw: 'timed out' })); });
    req.on('error', err => reject(Object.assign(err, { azRaw: err.message })));
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const err = Object.assign(new Error(`HTTP ${res.statusCode}: ${data}`), { httpStatus: res.statusCode, azRaw: data });
          return reject(err);
        }
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.setTimeout(HTTPS_TIMEOUT_MS, () => { req.destroy(Object.assign(new Error('Request timed out'), { azRaw: 'timed out' })); });
    req.on('error', err => reject(Object.assign(err, { azRaw: err.message })));
    req.end();
  });
}

app.listen(PORT, () => {
  log('info', `ZureMap proxy running on http://localhost:${PORT}`);
});
