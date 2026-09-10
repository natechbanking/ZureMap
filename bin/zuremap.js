#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const pkg = require('../package.json');

const HELP = `
  ZureMap ${pkg.version} — visualise your Azure estate from the terminal.

  Usage
    zuremap [options]

  Options
    -p, --port <n>     Port to listen on            (default 3001, env PORT)
    -H, --host <addr>  Address to bind              (default 127.0.0.1, env HOST)
        --no-open      Don't open the browser
    -v, --version      Print version and exit
    -h, --help         Show this help

  Requires the Azure CLI ('az') on PATH and an active 'az login' session.
`;

function fail(message) {
  process.stderr.write(`zuremap: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { port: undefined, host: undefined, open: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        process.exit(0);
        break;
      case '-v':
      case '--version':
        process.stdout.write(`${pkg.version}\n`);
        process.exit(0);
        break;
      case '-p':
      case '--port': {
        const value = Number(argv[++i]);
        if (!Number.isInteger(value) || value < 0 || value > 65535) fail(`invalid port: ${argv[i]}`);
        opts.port = value;
        break;
      }
      case '-H':
      case '--host':
        opts.host = argv[++i];
        if (!opts.host) fail('--host requires a value');
        break;
      case '--no-open':
        opts.open = false;
        break;
      default:
        fail(`unknown option: ${arg}\nRun 'zuremap --help' for usage.`);
    }
  }

  return opts;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] :
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
    ['xdg-open', [url]];

  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.on('error', () => { /* no browser available — the URL is printed anyway */ });
  child.unref();
}

function warnIfNoAzureCli() {
  execFile(process.platform === 'win32' ? 'where' : 'which', ['az'], (err) => {
    if (err) {
      process.stderr.write(
        "zuremap: the Azure CLI ('az') was not found on PATH — ZureMap needs it to read your subscriptions.\n" +
        '         Install it: https://learn.microsoft.com/cli/azure/install-azure-cli\n'
      );
    }
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  process.env.NODE_ENV = 'production';

  const { start, DIST_PATH } = require('../proxy/server');

  if (!fs.existsSync(path.join(DIST_PATH, 'index.html'))) {
    fail(
      `the built UI is missing at ${DIST_PATH}.\n` +
      "         If you installed from npm this is a packaging bug; from a clone, run 'npm run build' first."
    );
  }

  warnIfNoAzureCli();

  const host = opts.host ?? process.env.HOST ?? '127.0.0.1';

  start({
    port: opts.port,
    host,
    onListening: ({ port }) => {
      const displayHost = ['0.0.0.0', '::', '::1'].includes(host) ? 'localhost' : host;
      const url = `http://${displayHost}:${port}`;
      process.stdout.write(`\n  ZureMap is running at ${url}\n  Press Ctrl+C to stop.\n\n`);
      if (opts.open) openBrowser(url);
    },
  });
}

main();
