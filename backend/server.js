const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const os = require('os');
require('dotenv').config();
const transactionRoutes = require('./routes/transactions');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const budgetRoutes = require('./routes/budgets');
const goalRoutes = require('./routes/goals');
const recurringRoutes = require('./routes/recurring');
const categoryRoutes = require('./routes/categories');
const nextLevelRoutes = require('./routes/nextLevel');
const recurringService = require('./services/recurringService');
const { getAnalyticsCacheMetrics } = require('./services/analyticsService');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const AppError = require('./utils/appError');
const logger = require('./utils/logger');

// Security Middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const recurringJobRuntime = {
  enabled: false,
  instanceId: null,
  intervalMs: 0,
  leaseMs: 0,
  startedAt: null,
  lastRunAt: null,
  lastDurationMs: 0,
  lastCreated: 0,
  lastUsersProcessed: 0,
  lastError: null,
  leaseSkips: 0,
  runs: 0,
};

const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Use JWT_SECRET as fallback for REFRESH_TOKEN_SECRET if not provided
if (!process.env.REFRESH_TOKEN_SECRET) {
  logger.warn('⚠️  REFRESH_TOKEN_SECRET not set. Using JWT_SECRET as fallback (not recommended for production).');
  process.env.REFRESH_TOKEN_SECRET = process.env.JWT_SECRET;
}

// Connect to MongoDB -> Changed to Turso DB
const { connectDB } = require('./database');
connectDB();

// Apply security headers
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.disable('x-powered-by');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});
app.use('/api/', limiter);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new AppError(403, 'Origin not allowed by CORS policy.'));
  },
  credentials: true,
}));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('x-request-id', req.requestId);
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
  });
  next();
});

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/next-level', nextLevelRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', requestId: req.requestId });
});

app.get('/api/health/perf', (req, res) => {
  res.json({
    status: 'ok',
    requestId: req.requestId,
    uptimeSec: Number(process.uptime().toFixed(1)),
    analyticsCache: getAnalyticsCacheMetrics(),
    recurringJob: recurringJobRuntime,
  });
});

app.use(notFoundHandler);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);

  const recurringJobEnabled = (process.env.RECURRING_JOB_ENABLED || 'true').toLowerCase() === 'true';
  const recurringJobIntervalMs = Number(process.env.RECURRING_JOB_INTERVAL_MS || 300000);
  const recurringJobLeaseMs = Number(process.env.RECURRING_JOB_LEASE_MS || Math.max(recurringJobIntervalMs * 2, 60000));
  const recurringJobInstanceId = process.env.RECURRING_JOB_INSTANCE_ID || `${os.hostname()}-${process.pid}`;

  if (recurringJobEnabled && recurringJobIntervalMs > 0) {
    recurringJobRuntime.enabled = true;
    recurringJobRuntime.instanceId = recurringJobInstanceId;
    recurringJobRuntime.intervalMs = recurringJobIntervalMs;
    recurringJobRuntime.leaseMs = recurringJobLeaseMs;
    recurringJobRuntime.startedAt = new Date().toISOString();

    setInterval(async () => {
      const runStartedAt = Date.now();
      try {
        const lease = await recurringService.tryAcquireRecurringJobLease(recurringJobInstanceId, recurringJobLeaseMs);
        if (!lease.acquired) {
          recurringJobRuntime.leaseSkips += 1;
          return;
        }

        const result = await recurringService.materializeDueRecurringForAllUsers(new Date());
        recurringJobRuntime.lastRunAt = new Date().toISOString();
        recurringJobRuntime.lastDurationMs = Date.now() - runStartedAt;
        recurringJobRuntime.lastCreated = Number(result.created) || 0;
        recurringJobRuntime.lastUsersProcessed = Number(result.usersProcessed) || 0;
        recurringJobRuntime.lastError = null;
        recurringJobRuntime.runs += 1;

        if ((result.created || 0) > 0) {
          logger.info('Recurring background batch processed', result);
        }
      } catch (err) {
        recurringJobRuntime.lastRunAt = new Date().toISOString();
        recurringJobRuntime.lastDurationMs = Date.now() - runStartedAt;
        recurringJobRuntime.lastError = err.message;
        logger.error('Recurring background batch failed', { message: err.message });
      }
    }, recurringJobIntervalMs).unref?.();

    logger.info(`Recurring background job enabled (interval: ${recurringJobIntervalMs}ms, lease: ${recurringJobLeaseMs}ms)`);
  }
});
