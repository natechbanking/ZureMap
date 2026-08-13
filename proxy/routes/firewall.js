const { Router } = require('express');
const { getArmToken, azErrorBody } = require('../lib/az-cli');
const { httpsGet } = require('../lib/arm-client');
const { log } = require('../lib/logger');

const router = Router();

router.get('/firewall-policy-rule-counts', async (req, res) => {
  const firewallId = String(req.query.firewallId ?? '').trim();
  if (!firewallId) return res.status(400).json({ error: 'firewallId required' });

  const baseFirewallId = firewallId.replace(/\/$/, '');
  try {
    const token = await getArmToken();
    const authHeader = { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' };

    const firewall = await httpsGet(
      `${baseFirewallId}?api-version=2024-10-01`,
      authHeader,
    );

    const policyId = firewall?.properties?.firewallPolicy?.id;
    if (!policyId) {
      return res.json({ applicationRules: 0, networkRules: 0, natRules: 0, policyId: null });
    }

    const basePolicyId = String(policyId).replace(/\/$/, '');
    const groups = await httpsGet(
      `${basePolicyId}/ruleCollectionGroups?api-version=2024-10-01`,
      authHeader,
    );

    let applicationRules = 0;
    let networkRules = 0;
    let natRules = 0;

    for (const group of (groups?.value ?? [])) {
      const collections = group?.properties?.ruleCollections ?? [];
      for (const collection of collections) {
        const rules = collection?.rules ?? [];
        for (const rule of rules) {
          const ruleType = String(rule?.ruleType ?? '').toLowerCase();
          if (ruleType === 'applicationrule') applicationRules += 1;
          else if (ruleType === 'networkrule') networkRules += 1;
          else if (ruleType === 'natrule') natRules += 1;
        }
      }
    }

    log('info', `Firewall policy rule counts resolved for ${baseFirewallId}: app=${applicationRules} net=${networkRules} nat=${natRules}`);
    res.json({
      applicationRules,
      networkRules,
      natRules,
      policyId: basePolicyId,
    });
  } catch (err) {
    log('error', `Firewall policy rule count failed for ${baseFirewallId}:`, err.message);
    res.status(500).json(azErrorBody(err.azRaw ?? err.message));
  }
});

module.exports = router;
