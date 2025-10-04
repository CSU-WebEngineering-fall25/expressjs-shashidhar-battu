const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');

const comicsRouter = require('./routes/comics');
const loggingMiddleware = require('./middleware/logging');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

let stats = {
  totalRequests: 0,
  endpointStats: {},
  startTime: Date.now(),
};

app.use(helmet());
app.use(cors());
app.options('*', cors()); // ✅ for CORS preflight (204 No Content)

// ✅ Catch malformed JSON (must come before routes)
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf.toString(encoding));
      } catch (e) {
        throw new SyntaxError('Invalid JSON');
      }
    },
  })
);

// ✅ Custom 400 for bad JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.message.includes('Invalid JSON')) {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  next(err);
});

app.use(express.static(path.join(__dirname, '../public')));

// ✅ Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// ✅ Custom middlewares
app.use(loggingMiddleware);

// ✅ Stats middleware
app.use((req, res, next) => {
  stats.totalRequests++;
  const endpoint = `${req.method} ${req.path}`;
  stats.endpointStats[endpoint] = (stats.endpointStats[endpoint] || 0) + 1;
  next();
});

// ✅ Routes
app.use('/api/comics', comicsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalRequests: stats.totalRequests,
    endpointStats: stats.endpointStats,
    uptime: (Date.now() - stats.startTime) / 1000,
  });
});

// 404 for any unknown API
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// ✅ Error handler (must be last)
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
