const assert = require('node:assert/strict');
const test = require('node:test');
const { log, sanitizeLogString } = require('./logger');

test('sanitizes characters that can forge or manipulate log entries', () => {
  assert.equal(sanitizeLogString('safe\r\n[info] forged\0\x1b[2J'), 'safe\\r\\n[info] forged[2J');
});

test('sanitizes both the message and extra log arguments', (t) => {
  const calls = [];
  t.mock.method(console, 'log', (...args) => calls.push(args));

  log('info', 'account\nforged', 'detail\ranother');

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].includes('account\\nforged'), true);
  assert.equal(calls[0][1], 'detail\\ranother');
  assert.equal(calls.flat().some(value => String(value).includes('\n')), false);
});
