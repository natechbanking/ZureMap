const express = require('express');
const cors = require('cors');
const { log, dim, green, yellow, red, cyan } = require('./lib/logger');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

function createIpRateLimiter({ windowMs, maxRequests }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      hits.set(key, { windowStart: now, count: 1 });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
}

function parsePositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

app.use((req, res, next) => {
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
  const path = require('path');
  const distPath = path.join(__dirname, '../dist/zuremap/browser');
  const staticRateLimiter = createIpRateLimiter({
    windowMs: parsePositiveIntEnv('STATIC_RATE_WINDOW_MS', 60_000),
    maxRequests: parsePositiveIntEnv('STATIC_RATE_MAX_REQUESTS', 120),
  });
  app.use(staticRateLimiter);
  app.use(express.static(distPath));
  app.get('*splat', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const server = app.listen(PORT, HOST, () => {
  log('info', `ZureMap proxy running on http://${HOST}:${PORT}`);
});

// Keep the server handle referenced explicitly.
server.ref();

server.on('error', (err) => {
  log('error', `Proxy server error: ${err.message}`);
});

server.on('close', () => {
  log('warn', 'Proxy server closed.');
});

process.on('uncaughtException', (err) => {
  log('error', `Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection: ${String(reason)}`);
});
