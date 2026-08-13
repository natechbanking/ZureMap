const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeArmPath } = require('./arm-client');

test('accepts and normalizes Azure Resource Manager paths', () => {
  assert.equal(
    normalizeArmPath('/subscriptions/example/../example/providers?api-version=1'),
    '/subscriptions/example/providers?api-version=1'
  );
});

test('rejects paths that can escape the trusted ARM origin', () => {
  for (const path of ['https://example.com/', '//example.com/path', 'relative/path', '/path\nforged']) {
    assert.throws(() => normalizeArmPath(path), /Azure Resource Manager|Invalid Azure/);
  }
});
