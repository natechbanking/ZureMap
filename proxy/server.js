const path = require('path');
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { log, dim, green, yellow, red, cyan } = require('./lib/logger');

const DIST_PATH = path.join(__dirname, '../dist/zuremap/browser');

function parsePositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const statusColor = res.statusCode >= 500 ? red : res.statusCode >= 400 ? yellow : green;
      log('debug', `${req.method} ${cyan(req.path)} → ${statusColor(res.statusCode)} ${dim(ms + 'ms')}`);
    });
    next();
  });

  const corsOrigin = process.env.NODE_ENV === 'production' ? false : 'http://localhost:4200';
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.use('/api/az',  require('./routes/auth'));
  app.use('/api/az',  require('./routes/resources'));
  app.use('/api/az',  require('./routes/cost'));
  app.use('/api/az',  require('./routes/storage'));
  app.use('/api/az',  require('./routes/identity'));
  app.use('/api/az',  require('./routes/firewall'));
  app.use('/api/az',  require('./routes/dns'));
  app.use('/api',     require('./routes/diagram'));

  if (process.env.NODE_ENV === 'production') {
    const staticRateLimiter = rateLimit({
      windowMs: parsePositiveIntEnv('STATIC_RATE_WINDOW_MS', 60_000),
      limit: parsePositiveIntEnv('STATIC_RATE_MAX_REQUESTS', 120),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    });
    app.use(staticRateLimiter);
    app.use(express.static(DIST_PATH));
    app.get('*splat', (_req, res) => res.sendFile(path.join(DIST_PATH, 'index.html')));
  }

  return app;
}

function start({ port, host, onListening } = {}) {
  const PORT = Number(port ?? process.env.PORT ?? 3001);
  const HOST = host ?? process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

  const server = createApp().listen(PORT, HOST, () => {
    const { address, port: boundPort } = server.address();
    if (onListening) onListening({ host: address, port: boundPort });
    else log('info', `ZureMap proxy running on http://${address}:${boundPort}`);
  });

  // Keep the server handle referenced explicitly.
  server.ref();

  server.on('error', (err) => {
    log('error', `Proxy server error: ${err.message}`);
  });

  server.on('close', () => {
    log('warn', 'Proxy server closed.');
  });

  return server;
}

process.on('uncaughtException', (err) => {
  log('error', `Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection: ${String(reason)}`);
});

module.exports = { createApp, start, DIST_PATH };

if (require.main === module) start();
