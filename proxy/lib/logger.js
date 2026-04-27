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
  console.log(`${dim(ts)} ${prefix}${msg}`, ...extra);
}

module.exports = { log, dim, green, yellow, red, cyan };
