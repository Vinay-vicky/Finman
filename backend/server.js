const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const transactionRoutes = require('./routes/transactions');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const budgetRoutes = require('./routes/budgets');
const goalRoutes = require('./routes/goals');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const AppError = require('./utils/appError');
const logger = require('./utils/logger');

// Security Middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

const requiredEnvVars = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Connect to MongoDB -> Changed to Turso DB
const { connectDB } = require('./database');
connectDB();

// Apply security headers
app.use(helmet());
app.disable('x-powered-by');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
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


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', requestId: req.requestId });
});

app.use(notFoundHandler);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
