const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function cachedChrome(directory) {
  if (!fs.existsSync(directory)) return undefined;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isFile() && ['chrome', 'chrome.exe', 'Chromium'].includes(entry.name)) return filename;
    if (entry.isDirectory()) {
      const found = cachedChrome(filename);
      if (found) return found;
    }
  }
  return undefined;
}

const env = { ...process.env };
if (!env.CHROME_BIN) {
  const chrome = cachedChrome(path.join(os.homedir(), '.cache', 'puppeteer'));
  if (chrome) env.CHROME_BIN = chrome;
}

const result = spawnSync(process.execPath, [
  require.resolve('@angular/cli/bin/ng.js'), 'test', ...process.argv.slice(2),
], { stdio: 'inherit', env });
if (result.error) process.stderr.write(`${result.error.message}\n`);
process.exit(result.status ?? 1);
