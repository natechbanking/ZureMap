const https = require('https');

const HTTPS_TIMEOUT_MS = 30_000;
const ARM_ORIGIN = 'https://management.azure.com';
const ARM_HOSTNAME = 'management.azure.com';

function normalizeArmPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || /[\r\n\0]/.test(path)) {
    throw new TypeError('Invalid Azure Resource Manager path');
  }
  const url = new URL(path, ARM_ORIGIN);
  if (url.origin !== ARM_ORIGIN) {
    throw new TypeError('Azure Resource Manager path must stay on the trusted origin');
  }
  return `${url.pathname}${url.search}`;
}

function httpsRequest(method, path, headers, body) {
  const safePath = normalizeArmPath(path);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: ARM_HOSTNAME, path: safePath, method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(Object.assign(new Error(`HTTP ${res.statusCode}: ${data}`), { httpStatus: res.statusCode, azRaw: data }));
        }
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.setTimeout(HTTPS_TIMEOUT_MS, () => req.destroy(Object.assign(new Error('Request timed out'), { azRaw: 'timed out' })));
    req.on('error', err => reject(Object.assign(err, { azRaw: err.message })));
    if (body) req.write(body);
    req.end();
  });
}

const httpsGet  = (path, headers)       => httpsRequest('GET', path, headers);
const httpsPost = (path, headers, body) => httpsRequest('POST', path, headers, body);

module.exports = { normalizeArmPath, httpsRequest, httpsGet, httpsPost };
