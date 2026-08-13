const assert = require('node:assert/strict');
const test = require('node:test');
const router = require('./diagram');

function routeHandler(path, method) {
  const layer = router.stack.find((candidate) =>
    candidate.route?.path === path && candidate.route.methods[method]);
  return layer.route.stack[0].handle;
}

test('escapes user-controlled values in the diagram summary', () => {
  const payloads = [
    '<script>alert("lowercase")</script>',
    '<SCRIPT>alert("uppercase")</SCRIPT>',
  ];
  routeHandler('/diagram/state', 'post')({
    body: {
      nodes: payloads.map((resourceType) => ({ resourceType })),
      subscriptions: payloads.map((name) => ({ name })),
    },
  }, { json() {} });

  let contentType;
  let summary;
  const response = {
    type(value) {
      contentType = value;
      return this;
    },
    send(value) {
      summary = value;
    },
  };
  routeHandler('/mcp/diagram-summary', 'get')({}, response);

  assert.equal(contentType, 'text/plain; charset=utf-8');
  for (const payload of payloads) {
    assert.equal(summary.includes(payload), false);
  }
  assert.equal(summary.includes('&lt;script&gt;alert(&quot;lowercase&quot;)&lt;/script&gt;'), true);
  assert.equal(summary.includes('&lt;SCRIPT&gt;alert(&quot;uppercase&quot;)&lt;/SCRIPT&gt;'), true);
});
