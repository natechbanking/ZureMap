const https = require('https');
const { Router } = require('express');
const { getArmToken, azErrorBody } = require('../lib/az-cli');
const { httpsPost } = require('../lib/arm-client');
const { log } = require('../lib/logger');

const router = Router();

const PERIOD_PRESETS = new Set(['mtd', 'last30']);
const COST_ALIASES = ['PreTaxCost', 'Cost', 'CostInBillingCurrency', 'CostUSD', 'CostInUsd'];
const RESOURCE_ID_ALIASES = ['ResourceId', 'InstanceId'];
const CURRENCY_ALIASES = ['Currency', 'BillingCurrency', 'BillingCurrencyCode'];
const DATE_ALIASES = ['UsageDate', 'Date', 'UsageDateTime'];
const RESOURCE_GROUP_ALIASES = ['ResourceGroup', 'ResourceGroupName'];
const RESOURCE_TYPE_ALIASES = ['ResourceType', 'MeterCategory'];

class StructuredCostError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function normalizeResourceId(value) {
  if (!value) return '';
  return trimTrailingSlashes(String(value).trim().toLowerCase());
}

function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return end === value.length ? value : value.slice(0, end);
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(v => typeof v === 'string' && v.trim()) : [];
}

function resolveColumnIndex(columns, aliases, required = false) {
  for (const alias of aliases) {
    const idx = columns.findIndex(name => String(name).toLowerCase() === alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  if (required) {
    throw new StructuredCostError('MISSING_REQUIRED_COLUMN', `Missing required column. Expected one of: ${aliases.join(', ')}`, {
      aliases,
      columns,
    });
  }
  return -1;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAggregateRows(result, subscriptionId) {
  const rows = result?.properties?.rows ?? [];
  const cols = (result?.properties?.columns ?? []).map(col => col.name);

  const costIdx = resolveColumnIndex(cols, COST_ALIASES, true);
  const idIdx = resolveColumnIndex(cols, RESOURCE_ID_ALIASES, true);
  const curIdx = resolveColumnIndex(cols, CURRENCY_ALIASES, false);
  const rgIdx = resolveColumnIndex(cols, RESOURCE_GROUP_ALIASES, false);
  const typeIdx = resolveColumnIndex(cols, RESOURCE_TYPE_ALIASES, false);

  return rows
    .map(row => {
      const resourceId = String(row[idIdx] ?? '');
      const parsedType = String(row[typeIdx] ?? '').trim();
      const parsedRg = String(row[rgIdx] ?? '').trim();
      const parts = resourceId.split('/');

      return {
        subscriptionId,
        resourceId,
        normalizedResourceId: normalizeResourceId(resourceId),
        originalCost: safeNumber(row[costIdx]),
        originalCurrency: String(row[curIdx] ?? 'USD'),
        resourceGroup: parsedRg || String(parts[4] ?? 'unknown'),
        resourceType: parsedType || trimTrailingSlashes(`${parts[6] ?? 'unknown'}/${parts[7] ?? ''}`),
      };
    })
    .filter(row => row.resourceId);
}

function parseTrendRows(result) {
  const rows = result?.properties?.rows ?? [];
  const cols = (result?.properties?.columns ?? []).map(col => col.name);

  const costIdx = resolveColumnIndex(cols, COST_ALIASES, true);
  const dateIdx = resolveColumnIndex(cols, DATE_ALIASES, true);
  const curIdx = resolveColumnIndex(cols, CURRENCY_ALIASES, false);

  return rows.map(row => ({
    date: String(row[dateIdx] ?? ''),
    originalCost: safeNumber(row[costIdx]),
    originalCurrency: String(row[curIdx] ?? 'USD'),
  })).filter(r => r.date);
}

function todayIsoDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgoIsoDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function getTimeframe(periodPreset) {
  if (periodPreset === 'last30') {
    return {
      timeframe: 'Custom',
      timePeriod: {
        from: `${daysAgoIsoDate(29)}T00:00:00Z`,
        to: `${todayIsoDate()}T23:59:59Z`,
      },
    };
  }

  return {
    timeframe: 'MonthToDate',
  };
}

function buildDatasetFilter(filters) {
  const and = [];
  const resourceGroups = toArray(filters?.resourceGroup);
  const resourceTypes = toArray(filters?.resourceType);

  if (resourceGroups.length > 0) {
    and.push({
      dimensions: {
        name: 'ResourceGroup',
        operator: 'In',
        values: resourceGroups,
      },
    });
  }

  if (resourceTypes.length > 0) {
    and.push({
      dimensions: {
        name: 'ResourceType',
        operator: 'In',
        values: resourceTypes,
      },
    });
  }

  if (and.length === 0) return undefined;
  if (and.length === 1) return and[0];
  return { and };
}

function httpsGetJson(host, path, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectCount >= 5) {
              reject(new Error('Rate lookup exceeded redirect limit'));
              return;
            }
            try {
              const nextUrl = new URL(res.headers.location, `https://${host}`);
              httpsGetJson(nextUrl.hostname, `${nextUrl.pathname}${nextUrl.search}`, redirectCount + 1)
                .then(resolve)
                .catch(reject);
              return;
            } catch {
              reject(new Error('Rate lookup returned invalid redirect URL'));
              return;
            }
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Rate lookup failed with status ${res.statusCode ?? 0}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Rate lookup returned invalid JSON'));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function loadRatesToBase(baseCurrency) {
  const base = String(baseCurrency || 'EUR').toUpperCase();
  const asOf = todayIsoDate();

  const sources = [
    {
      source: 'frankfurter.app',
      run: async () => {
        const json = await httpsGetJson('api.frankfurter.app', `/latest?from=${encodeURIComponent(base)}`);
        const rates = json?.rates ?? {};
        const ratesToBase = { [base]: 1 };
        for (const [currency, baseToCurrency] of Object.entries(rates)) {
          const v = safeNumber(baseToCurrency);
          if (v > 0) ratesToBase[currency.toUpperCase()] = 1 / v;
        }
        return {
          source: 'frankfurter.app',
          asOf: String(json?.date ?? asOf),
          ratesToBase,
        };
      },
    },
    {
      source: 'open.er-api.com',
      run: async () => {
        const json = await httpsGetJson('open.er-api.com', `/v6/latest/${encodeURIComponent(base)}`);
        const rates = json?.rates ?? {};
        const ratesToBase = { [base]: 1 };
        for (const [currency, baseToCurrency] of Object.entries(rates)) {
          const v = safeNumber(baseToCurrency);
          if (v > 0) ratesToBase[currency.toUpperCase()] = 1 / v;
        }
        return {
          source: 'open.er-api.com',
          asOf,
          ratesToBase,
        };
      },
    },
  ];

  for (const source of sources) {
    try {
      return await source.run();
    } catch (error) {
      log('warn', `Currency conversion source ${source.source} unavailable: ${error.message}`);
    }
  }

  return {
    source: 'fallback-static',
    asOf,
    ratesToBase: { [base]: 1 },
  };
}

function convertToBase(amount, currency, ratesToBase) {
  const c = String(currency || '').toUpperCase();
  const rate = safeNumber(ratesToBase[c]);
  if (!rate) return { converted: amount, rate: 1, convertedWithFallback: true };
  return { converted: amount * rate, rate, convertedWithFallback: false };
}

function createBreakdownRows(map) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50);
}

function sanitizeRequest(body) {
  const rawSubIds = toArray(body?.subscriptionIds);
  const periodPreset = PERIOD_PRESETS.has(body?.periodPreset) ? body.periodPreset : 'mtd';
  const includeTrend = body?.includeTrend !== false;
  const baseCurrency = String(body?.baseCurrency || 'EUR').toUpperCase();
  const resourceIds = toArray(body?.resourceIds);

  return {
    subscriptionIds: [...new Set(rawSubIds)],
    periodPreset,
    includeTrend,
    baseCurrency,
    filters: {
      resourceGroup: toArray(body?.filters?.resourceGroup),
      resourceType: toArray(body?.filters?.resourceType),
    },
    resourceIds,
  };
}

async function runCostQueryForSubscription(token, subscriptionId, request) {
  const timeframe = getTimeframe(request.periodPreset);
  const filter = buildDatasetFilter(request.filters);

  const aggregateBody = {
    type: 'ActualCost',
    timeframe: timeframe.timeframe,
    ...(timeframe.timePeriod ? { timePeriod: timeframe.timePeriod } : {}),
    dataset: {
      granularity: 'None',
      grouping: [
        { type: 'Dimension', name: 'ResourceId' },
        { type: 'Dimension', name: 'ResourceGroup' },
        { type: 'Dimension', name: 'ResourceType' },
      ],
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      ...(filter ? { filter } : {}),
    },
  };

  const aggregateResult = await httpsPost(
    'management.azure.com',
    `/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
    { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    JSON.stringify(aggregateBody)
  );

  const aggregateRows = parseAggregateRows(aggregateResult, subscriptionId);

  if (!request.includeTrend) {
    return { aggregateRows, trendRows: [] };
  }

  const trendBody = {
    type: 'ActualCost',
    timeframe: timeframe.timeframe,
    ...(timeframe.timePeriod ? { timePeriod: timeframe.timePeriod } : {}),
    dataset: {
      granularity: 'Daily',
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      ...(filter ? { filter } : {}),
    },
  };

  const trendResult = await httpsPost(
    'management.azure.com',
    `/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
    { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    JSON.stringify(trendBody)
  );

  const trendRows = parseTrendRows(trendResult);
  return { aggregateRows, trendRows };
}

async function queryCostV2(rawRequest) {
  const request = sanitizeRequest(rawRequest);

  if (request.subscriptionIds.length === 0) {
    throw new StructuredCostError('INVALID_REQUEST', 'subscriptionIds[] required', {
      field: 'subscriptionIds',
    });
  }

  const token = await getArmToken();
  const conversion = await loadRatesToBase(request.baseCurrency);

  const subscriptions = [];
  const resources = [];
  const trendByDate = new Map();
  const warnings = [];

  for (const subscriptionId of request.subscriptionIds) {
    try {
      const { aggregateRows, trendRows } = await runCostQueryForSubscription(token, subscriptionId, request);

      let loadedRows = 0;
      let conversionRateToBase = 1;
      for (const row of aggregateRows) {
        const { converted, rate, convertedWithFallback } = convertToBase(row.originalCost, row.originalCurrency, conversion.ratesToBase);
        resources.push({
          ...row,
          costInBaseCurrency: converted,
        });
        loadedRows += 1;
        conversionRateToBase = rate;
        if (convertedWithFallback) {
          warnings.push(`No conversion rate for ${row.originalCurrency}. Used passthrough rate 1.`);
        }
      }

      for (const row of trendRows) {
        const { converted, convertedWithFallback } = convertToBase(row.originalCost, row.originalCurrency, conversion.ratesToBase);
        const prev = trendByDate.get(row.date) ?? 0;
        trendByDate.set(row.date, prev + converted);
        if (convertedWithFallback) {
          warnings.push(`Trend conversion rate missing for ${row.originalCurrency}. Used passthrough rate 1.`);
        }
      }

      subscriptions.push({
        subscriptionId,
        status: 'success',
        loadedRows,
        originalCurrency: aggregateRows[0]?.originalCurrency,
        conversionRateToBase,
      });
    } catch (error) {
      const reason = error?.code === 'MISSING_REQUIRED_COLUMN'
        ? `Cost query schema mismatch: ${error.message}`
        : (error?.message ?? 'Unknown cost query failure');
      subscriptions.push({
        subscriptionId,
        status: 'failed',
        reason,
      });
      log('warn', `FinOps v2 cost query failed for ${subscriptionId}: ${reason}`);
    }
  }

  const byResourceGroup = new Map();
  const byResourceType = new Map();
  let totalCostInBaseCurrency = 0;

  for (const row of resources) {
    totalCostInBaseCurrency += row.costInBaseCurrency;
    byResourceGroup.set(row.resourceGroup, (byResourceGroup.get(row.resourceGroup) ?? 0) + row.costInBaseCurrency);
    byResourceType.set(row.resourceType, (byResourceType.get(row.resourceType) ?? 0) + row.costInBaseCurrency);
  }

  const normalizedRequestedIds = request.resourceIds.map(normalizeResourceId).filter(Boolean);
  const requestedIdSet = new Set(normalizedRequestedIds);
  const costIdSet = new Set(resources.map(r => r.normalizedResourceId).filter(Boolean));

  const matchedResourceCount = normalizedRequestedIds.filter(id => costIdSet.has(id)).length;
  const unmatchedRequestedIds = normalizedRequestedIds.filter(id => !costIdSet.has(id));
  const matchedCostRows = requestedIdSet.size === 0
    ? resources.length
    : resources.filter(r => requestedIdSet.has(r.normalizedResourceId)).length;
  const unmatchedCostRows = requestedIdSet.size === 0
    ? 0
    : resources.filter(r => !requestedIdSet.has(r.normalizedResourceId));

  const trend = [...trendByDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const failedSubscriptionCount = subscriptions.filter(s => s.status === 'failed').length;
  if (failedSubscriptionCount > 0) {
    warnings.push(`${failedSubscriptionCount} subscription(s) failed and are excluded from totals.`);
  }

  return {
    periodPreset: request.periodPreset,
    baseCurrency: request.baseCurrency,
    totalCostInBaseCurrency,
    costedResourceCount: resources.length,
    loadedSubscriptionCount: subscriptions.filter(s => s.status === 'success').length,
    failedSubscriptionCount,
    subscriptions,
    resources: resources.sort((a, b) => b.costInBaseCurrency - a.costInBaseCurrency),
    topResources: resources
      .slice()
      .sort((a, b) => b.costInBaseCurrency - a.costInBaseCurrency)
      .slice(0, 10),
    byResourceGroup: createBreakdownRows(byResourceGroup),
    byResourceType: createBreakdownRows(byResourceType),
    trend,
    diagnostics: {
      requestedResourceCount: normalizedRequestedIds.length,
      matchedResourceCount,
      unmatchedResourceCount: unmatchedRequestedIds.length,
      sampleUnmatchedResourceIds: unmatchedRequestedIds.slice(0, 20),
      matchedCostRowCount: matchedCostRows,
      unmatchedCostRowCount: unmatchedCostRows.length,
      sampleUnmatchedCostResourceIds: unmatchedCostRows.slice(0, 20).map(r => r.resourceId),
    },
    warnings: [...new Set(warnings)],
    conversion: {
      source: conversion.source,
      asOf: conversion.asOf,
      ratesToBase: conversion.ratesToBase,
    },
  };
}

router.post('/cost/v2', async (req, res) => {
  try {
    const payload = await queryCostV2(req.body ?? {});
    const total = payload.totalCostInBaseCurrency.toFixed(2);
    log('info', `FinOps v2 query (${payload.periodPreset}): ${payload.baseCurrency} ${total} across ${payload.costedResourceCount} resources.`);
    res.json(payload);
  } catch (err) {
    if (err instanceof StructuredCostError) {
      res.status(400).json({
        error: err.message,
        code: err.code,
        details: err.details,
      });
      return;
    }

    log('error', 'FinOps v2 query failed:', err.message);
    const raw = err.azRaw ?? err.message ?? '';
    const status = (err.httpStatus === 403 || String(raw).includes('403')) ? 403 : 500;
    res.status(status).json(azErrorBody(raw));
  }
});

router.post('/cost', async (req, res) => {
  const body = req.body ?? {};
  const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : '';

  if (!subscriptionId) {
    return res.status(400).json({ error: 'subscriptionId required' });
  }

  try {
    const payload = await queryCostV2({
      subscriptionIds: [subscriptionId],
      periodPreset: 'mtd',
      includeTrend: false,
      baseCurrency: 'USD',
      filters: {},
      resourceIds: [],
    });

    const failed = payload.subscriptions.find(s => s.status === 'failed');
    if (failed && payload.loadedSubscriptionCount === 0) {
      const status = failed.reason?.includes('403') ? 403 : 500;
      return res.status(status).json({
        error: failed.reason || 'Failed to query subscription cost.',
      });
    }

    const byRg = Object.fromEntries(payload.byResourceGroup.map(r => [r.key, r.value]));
    const byType = Object.fromEntries(payload.byResourceType.map(r => [r.key, r.value]));

    return res.json({
      totalUsd: payload.totalCostInBaseCurrency,
      currency: payload.baseCurrency,
      byResourceGroup: byRg,
      byResourceType: byType,
      resources: payload.resources.map(row => ({
        resourceId: row.resourceId,
        costUsd: row.costInBaseCurrency,
        currency: payload.baseCurrency,
        billingPeriod: 'Month to Date',
      })),
    });
  } catch (err) {
    log('error', `Cost query failed (sub ${subscriptionId}):`, err.message);
    const raw = err.azRaw ?? err.message ?? '';
    const status = (err.httpStatus === 403 || String(raw).includes('403')) ? 403 : 500;
    return res.status(status).json(azErrorBody(raw));
  }
});

module.exports = router;
