const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const https = require('https');

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// In-memory diagram state cache (written by Angular via a POST endpoint)
let currentDiagramState = null;

function runAz(args) {
  return new Promise((resolve, reject) => {
    execFile('az', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try { resolve(JSON.parse(stdout)); }
      catch { resolve(stdout.trim()); }
    });
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.get('/api/az/login-status', async (req, res) => {
  try {
    const account = await runAz(['account', 'show', '--output', 'json']);
    res.json({ loggedIn: true, account });
  } catch {
    res.json({ loggedIn: false });
  }
});

app.post('/api/az/login', async (req, res) => {
  try {
    await runAz(['login', '--output', 'json']);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/az/token', async (req, res) => {
  const resource = req.query.resource || 'https://management.azure.com/';
  try {
    const token = await runAz(['account', 'get-access-token', '--resource', resource, '--output', 'json']);
    res.json(token);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const body = JSON.stringify({
      query,
      subscriptions,
      options: { $skipToken, resultFormat: 'objectArray' },
    });

    const result = await httpsPost(
      'management.azure.com',
      '/providers/Microsoft.ResourceGraph/resources?api-version=2024-04-01',
      { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
      body
    );
    res.json({ data: result.data ?? [], $skipToken: result.$skipToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    let skipToken;
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
      if (batch.length > 0) {
        res.write(`data: ${JSON.stringify(batch)}\n\n`);
      }
      skipToken = result.$skipToken;
    } while (skipToken);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
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
  } catch (err) {
    const status = err.message?.includes('403') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── Diagram State Cache (for MCP) ───────────────────────────────────────────

app.post('/api/diagram/state', (req, res) => {
  currentDiagramState = req.body;
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

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.listen(PORT, () => {
  console.log(`ZureMap proxy running on http://localhost:${PORT}`);
});
