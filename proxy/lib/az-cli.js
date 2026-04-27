const { execFile } = require('child_process');

const AZ_TIMEOUT_MS = 60_000;

function runAz(args) {
  return new Promise((resolve, reject) => {
    execFile('az', args, { maxBuffer: 50 * 1024 * 1024, timeout: AZ_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) {
        const raw = stderr || err.message || '';
        return reject(Object.assign(new Error(raw), { azRaw: raw }));
      }
      try { resolve(JSON.parse(stdout)); }
      catch { resolve(stdout.trim()); }
    });
  });
}

function getArmToken() {
  return runAz(['account', 'get-access-token', '--resource', 'https://management.azure.com/', '--output', 'json']);
}

function classifyAzError(raw = '') {
  const s = raw.toLowerCase();
  if (s.includes('nameresolutionerror') || s.includes('failed to resolve') || s.includes('name or service not known') || s.includes('[errno -3]') || s.includes('max retries exceeded')) {
    return { code: 'NO_NETWORK', message: 'Cannot reach Azure — no network connectivity. Check your internet connection and try again.' };
  }
  if (s.includes('az login') || s.includes('please run') || s.includes('not logged in') || s.includes('unauthorized_client') || s.includes('aadsts')) {
    return { code: 'AUTH_REQUIRED', message: "Azure CLI authentication required. Please run 'az login' and try again." };
  }
  if (s.includes('timed out') || s.includes('etimedout') || s.includes('timeout')) {
    return { code: 'TIMEOUT', message: 'Request timed out. Azure services may be temporarily unavailable — try again in a moment.' };
  }
  if (s.includes('403') || s.includes('forbidden') || s.includes('authorizationfailed')) {
    return { code: 'PERMISSION_DENIED', message: 'Insufficient permissions to complete this request.' };
  }
  if (s.includes('429') || s.includes('too many requests') || s.includes('throttl')) {
    return { code: 'QUOTA_EXCEEDED', message: 'Azure throttled the request. Wait a few seconds and try again.' };
  }
  return { code: 'SERVER_ERROR', message: 'An unexpected error occurred while communicating with Azure.' };
}

function azErrorBody(raw) {
  const { code, message } = classifyAzError(raw);
  return { error: message, code, detail: raw.slice(0, 800) };
}

module.exports = { runAz, getArmToken, classifyAzError, azErrorBody };
