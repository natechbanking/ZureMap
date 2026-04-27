const { Router } = require('express');
const { runAz, azErrorBody } = require('../lib/az-cli');
const { log } = require('../lib/logger');

const router = Router();

router.get('/uai-role-assignments', async (req, res) => {
  const principalId    = String(req.query.principalId    ?? '').trim();
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
      scope:              a.scope              ?? 'Unknown scope',
      principalType:      a.principalType      ?? 'Principal',
      description:        a.description        ?? null,
    }));

    log('info', `UAI role assignments: principal ${principalId} in ${subscriptionId} -> ${normalized.length}`);
    res.json(normalized);
  } catch (err) {
    log('error', `UAI role assignments failed for principal ${principalId}:`, err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

module.exports = router;
