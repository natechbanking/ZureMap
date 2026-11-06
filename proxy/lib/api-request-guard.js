const { isIP } = require('node:net');

function parseAuthority(authority) {
  if (typeof authority !== 'string' || /[\\/?#@\s]/.test(authority)) return null;
  try {
    return new URL(`http://${authority}`);
  } catch {
    return null;
  }
}

function createApiRequestGuard({ host, production = process.env.NODE_ENV === 'production' } = {}) {
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  for (const entry of [host, process.env.HOST, ...(process.env.ZUREMAP_ALLOWED_HOSTS || '').split(',')]) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const parsed = parseAuthority(entry.trim());
    if (parsed) allowedHosts.add(parsed.hostname);
  }

  return (req, res, next) => {
    const authority = parseAuthority(req.headers.host);
    const hostname = authority?.hostname;
    const ip = hostname?.replace(/^\[|\]$/g, '');
    if (!hostname || (!allowedHosts.has(hostname) && !isIP(ip))) {
      return res.status(403).json({ error: 'Untrusted API host' });
    }

    const origin = req.headers.origin;
    if (origin !== undefined) {
      let trustedOrigin = !production && origin === 'http://localhost:4200';
      try {
        const parsed = new URL(origin);
        trustedOrigin ||= ['http:', 'https:'].includes(parsed.protocol)
          && parsed.origin === origin
          && parsed.host === new URL(`${parsed.protocol}//${req.headers.host}`).host;
      } catch {
        // Invalid and opaque origins are rejected below.
      }
      if (!trustedOrigin) return res.status(403).json({ error: 'Untrusted API origin' });
    }

    if (req.headers['sec-fetch-site'] === 'cross-site') {
      return res.status(403).json({ error: 'Cross-site API requests are not allowed' });
    }
    next();
  };
}

module.exports = { createApiRequestGuard };
