const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createApiRequestGuard } = require('./api-request-guard');

async function withApi(t, options) {
  const app = express();
  let calls = 0;
  app.use('/api', createApiRequestGuard(options));
  app.all('/api/token', (_req, res) => {
    calls += 1;
    res.json({ accessToken: 'secret' });
  });
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(listening));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return {
    calls: () => calls,
    request: (headers, method = 'GET') => new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: server.address().port, path: '/api/token', method, headers,
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    }),
  };
}

test('rejects cross-origin browser reads and simple POSTs before API handlers run', async t => {
  const api = await withApi(t);
  for (const method of ['GET', 'POST']) {
    const response = await api.request({ Host: 'localhost:3001', Origin: 'https://attacker.example' }, method);
    assert.equal(response.status, 403);
    assert.equal(response.body.includes('secret'), false);
  }
  assert.equal(api.calls(), 0);
});

test('rejects cross-site requests without Origin, opaque origins and DNS rebinding hosts', async t => {
  const api = await withApi(t);
  for (const headers of [
    { Host: 'localhost:3001', 'Sec-Fetch-Site': 'cross-site' },
    { Host: 'localhost:3001', Origin: 'null' },
    { Host: 'localhost:3001', Origin: 'http://localhost:3001/path' },
    { Host: 'localhost:3001', Origin: 'http://localhost:3001@attacker.example' },
    { Host: 'localhost:3001', Origin: 'not-an-origin' },
    { Host: 'attacker.example:3001', Origin: 'http://attacker.example:3001' },
    { Host: 'attacker.example:3001', 'X-Forwarded-Host': 'localhost:3001' },
    { Host: 'localhost.attacker.example:3001' },
    { Host: 'localhost:3001@attacker.example' },
  ]) {
    assert.equal((await api.request(headers)).status, 403);
  }
  assert.equal(api.calls(), 0);
});

test('allows local CLI clients, Angular development and same-origin Docker clients', async t => {
  const api = await withApi(t, { production: false });
  for (const headers of [
    { Host: 'localhost:3001' },
    { Host: '127.0.0.1:3001' },
    { Host: '[::1]:3001' },
    { Host: 'localhost:3001', Origin: 'http://localhost:4200' },
    { Host: '192.168.1.20:3001', Origin: 'http://192.168.1.20:3001' },
  ]) {
    assert.equal((await api.request(headers)).status, 200);
  }
});

test('allows explicitly configured DNS hosts and custom CLI bind hosts', async t => {
  const previous = process.env.ZUREMAP_ALLOWED_HOSTS;
  process.env.ZUREMAP_ALLOWED_HOSTS = 'zuremap.example, diagrams.internal';
  t.after(() => {
    if (previous === undefined) delete process.env.ZUREMAP_ALLOWED_HOSTS;
    else process.env.ZUREMAP_ALLOWED_HOSTS = previous;
  });
  const api = await withApi(t, { production: true, host: 'custom.internal' });
  for (const hostname of ['zuremap.example', 'diagrams.internal', 'custom.internal']) {
    assert.equal((await api.request({ Host: `${hostname}:3001`, Origin: `http://${hostname}:3001` })).status, 200);
  }
  assert.equal((await api.request({ Host: 'custom.internal:3001', Origin: 'http://localhost:4200' })).status, 403);
  assert.equal((await api.request({ Host: 'custom.internal:3001', Origin: 'http://custom.internal:4000' })).status, 403);
});
