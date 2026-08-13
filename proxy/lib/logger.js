const { inspect } = require('node:util');

const dim    = s => `\x1b[2m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const cyan   = s => `\x1b[36m${s}\x1b[0m`;

function log(level, msg, ...extra) {
  const ts = new Date().toTimeString().slice(0, 8);
  const prefix = level === 'info'  ? green('[info] ') :
                 level === 'warn'  ? yellow('[warn] ') :
                 level === 'error' ? red('[err]  ') :
                                     dim('[dbg]  ');
  const safeMessage = sanitizeLogString(msg);
  const safeExtra = extra.map(value => sanitizeLogString(
    typeof value === 'string' ? value : inspect(value, { breakLength: Infinity })
  ));
  console.log(`${dim(ts)} ${prefix}${safeMessage}`, ...safeExtra);
}

function sanitizeLogString(value) {
  return String(value)
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');
}

module.exports = { log, sanitizeLogString, dim, green, yellow, red, cyan };
