const assert = require('node:assert/strict');
const test = require('node:test');
const router = require('./diagram');

function routeHandler(path, method) {
  const layer = router.stack.find((candidate) =>
    candidate.route?.path === path && candidate.route.methods[method]);
  return layer.route.stack[0].handle;
}

test('escapes user-controlled values in the diagram summary', () => {
  const payload = '<script>alert("xss")</script>';
  routeHandler('/diagram/state', 'post')({
    body: {
      nodes: [{ resourceType: payload }],
      subscriptions: [{ name: payload }],
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
  assert.doesNotMatch(summary, /<script>/);
  assert.match(summary, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
});
