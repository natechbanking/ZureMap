const express = require('express');
const cors = require('cors');
const { log, dim, green, yellow, red, cyan } = require('./lib/logger');

const app = express();
const PORT = 3001;

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

app.listen(PORT, () => {
  log('info', `ZureMap proxy running on http://localhost:${PORT}`);
});
