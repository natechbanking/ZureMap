const { Router } = require('express');
const escapeHtml = require('escape-html');
const { getState, setState, buildMarkdownSummary, isValidDiagramState } = require('../lib/diagram-state');
const { log } = require('../lib/logger');

const router = Router();

router.post('/diagram/state', (req, res) => {
  if (!isValidDiagramState(req.body)) {
    return res.status(400).json({ error: 'Invalid diagram state' });
  }
  setState(req.body);
  const nodeCount = req.body?.nodes?.length ?? 0;
  const edgeCount = req.body?.edges?.length ?? 0;
  log('debug', `Diagram state updated: ${nodeCount} nodes, ${edgeCount} edges`);
  res.json({ ok: true });
});

router.get('/mcp/diagram-summary', (req, res) => {
  const state = getState();
  if (!state) {
    return res.status(503).type('text/plain; charset=utf-8').send('# ZureMap\nNo diagram loaded yet. Run a scan first.');
  }
  res.type('text/plain; charset=utf-8').send(escapeHtml(buildMarkdownSummary(state)));
});

module.exports = router;
