const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('node:https');
const test = require('node:test');
const azCli = require('../lib/az-cli');
const armClient = require('../lib/arm-client');

function costHandler(t, path) {
  t.mock.method(azCli, 'getArmToken', async () => ({ accessToken: 'test-token' }));
  t.mock.method(armClient, 'httpsPost', async () => ({
    properties: {
      columns: [{ name: 'PreTaxCost' }, { name: 'ResourceId' }, { name: 'Currency' }],
      rows: [[10, '/subscriptions/test/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm', 'USD']],
    },
  }));
  t.mock.method(https, 'request', (_options, callback) => {
    const request = new EventEmitter();
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = 200;
      response.headers = {};
      callback(response);
      response.emit('data', JSON.stringify({ rates: { USD: 1 }, date: '2026-01-01' }));
      response.emit('end');
    };
    return request;
  });
  delete require.cache[require.resolve('./cost')];
  const router = require('./cost');
  t.after(() => { delete require.cache[require.resolve('./cost')]; });
  return router.stack.find(layer => layer.route?.path === path).route.stack[0].handle;
}

async function invoke(handler, body) {
  let status = 200;
  let payload;
  await handler({ body }, {
    status(value) { status = value; return this; },
    json(value) { payload = value; return this; },
  });
  return { status, payload };
}

test('legacy subscription cost summaries work without requested resource IDs', async t => {
  const result = await invoke(costHandler(t, '/cost'), { subscriptionId: 'test' });
  assert.equal(result.status, 200);
  assert.equal(result.payload.totalUsd, 10);
  assert.equal(result.payload.resources.length, 1);
  assert.equal(result.payload.resources[0].costUsd, 10);
});

test('v2 cost diagnostics return empty unmatched rows when no resource filter is provided', async t => {
  const result = await invoke(costHandler(t, '/cost/v2'), {
    subscriptionIds: ['test'], includeTrend: false, baseCurrency: 'USD',
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.totalCostInBaseCurrency, 10);
  assert.equal(result.payload.diagnostics.unmatchedCostRowCount, 0);
  assert.deepEqual(result.payload.diagnostics.sampleUnmatchedCostResourceIds, []);
});
