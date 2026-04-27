const express = require('express');
const cors = require('cors');
const { log, dim, green, yellow, red, cyan } = require('./lib/logger');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const statusColor = res.statusCode >= 500 ? red : res.statusCode >= 400 ? yellow : green;
    log('debug', `${req.method} ${cyan(req.path)} → ${statusColor(res.statusCode)} ${dim(ms + 'ms')}`);
  });
  next();
});

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.use('/api/az',  require('./routes/auth'));
app.use('/api/az',  require('./routes/resources'));
app.use('/api/az',  require('./routes/cost'));
app.use('/api/az',  require('./routes/storage'));
app.use('/api/az',  require('./routes/identity'));
app.use('/api/az',  require('./routes/firewall'));
app.use('/api',     require('./routes/diagram'));

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
