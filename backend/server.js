const express = require('express');
const cors = require('cors');
const transactionRoutes = require('./routes/transactions');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const budgetRoutes = require('./routes/budgets');
const goalRoutes = require('./routes/goals');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB -> Changed to Turso DB
const { connectDB } = require('./database');
connectDB();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
