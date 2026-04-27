const https = require('https');

const HTTPS_TIMEOUT_MS = 30_000;

function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
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

const httpsGet  = (hostname, path, headers)      => httpsRequest('GET',  hostname, path, headers);
const httpsPost = (hostname, path, headers, body) => httpsRequest('POST', hostname, path, headers, body);

module.exports = { httpsRequest, httpsGet, httpsPost };
