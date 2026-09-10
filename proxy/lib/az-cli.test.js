const assert = require('node:assert/strict');
const test = require('node:test');
const { assertSafeAzArgs } = require('./az-cli');

test('accepts every az invocation the routes actually make', () => {
  const calls = [
    ['account', 'show', '--output', 'json'],
    ['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json'],
    ['login', '--output', 'json'],
    ['account', 'list', '--output', 'json'],
    ['account', 'tenant', 'list', '--output', 'json'],
    ['rest', '--method', 'GET', '--url', 'https://management.azure.com/tenants?api-version=2022-12-01', '--output', 'json'],
    [
      'role', 'assignment', 'list',
      '--assignee-object-id', '55ae1afe-4a51-4569-aa75-8fbc26c2f337',
      '--subscription', '3f1c2b8a-1111-2222-3333-444455556666',
      '--include-inherited', '--all', '--output', 'json',
    ],
  ];
  for (const args of calls) {
    assert.doesNotThrow(() => assertSafeAzArgs(args), `should accept: ${args.join(' ')}`);
  }
});

test('rejects az commands outside the allowlist', () => {
  assert.throws(() => assertSafeAzArgs(['storage', 'blob', 'delete']), /not allowed/);
  assert.throws(() => assertSafeAzArgs(['ad', 'sp', 'create-for-rbac']), /not allowed/);
});

test('rejects empty and non-array argument lists', () => {
  assert.throws(() => assertSafeAzArgs([]), /non-empty array/);
  assert.throws(() => assertSafeAzArgs('account show'), /non-empty array/);
});

test('rejects arguments that are not plain permitted strings', () => {
  assert.throws(() => assertSafeAzArgs(['account', 42]), /permitted pattern/);
  assert.throws(() => assertSafeAzArgs(['account', null]), /permitted pattern/);
});

test('rejects values that smuggle in whitespace, newlines or shell metacharacters', () => {
  assert.throws(() => assertSafeAzArgs(['account', 'show --debug']), /permitted pattern/);
  assert.throws(() => assertSafeAzArgs(['account', 'show\n--debug']), /permitted pattern/);
  assert.throws(() => assertSafeAzArgs(['account', '$(rm -rf /)']), /permitted pattern/);
  assert.throws(() => assertSafeAzArgs(['account', '`id`']), /permitted pattern/);
  assert.throws(() => assertSafeAzArgs(['account', 'a;b']), /permitted pattern/);
});
