const assert = require('node:assert/strict');
const test = require('node:test');
const { ARM_TOKEN_RESOURCE, isUuid, isArmTokenResource } = require('./azure-validation');

test('accepts Azure UUIDs and rejects option-like CLI arguments', () => {
  assert.equal(isUuid('55ae1afe-4a51-4569-aa75-8fbc26c2f337'), true);
  assert.equal(isUuid('--help'), false);
  assert.equal(isUuid('55ae1afe-4a51-4569-aa75-8fbc26c2f337\n--help'), false);
});

test('only accepts the Azure Resource Manager token audience', () => {
  assert.equal(isArmTokenResource(ARM_TOKEN_RESOURCE), true);
  assert.equal(isArmTokenResource('https://example.com/'), false);
  assert.equal(isArmTokenResource('--help'), false);
});
