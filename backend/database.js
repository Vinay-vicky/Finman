const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL || 'file:./local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url,
  authToken,
});

const connectDB = async () => {
  try {
    console.log('Connected to Turso database (or local file fallback).');
    
    // Create tables if they don't exist
    await db.batch([
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        category TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('income', 'expense')),
        color TEXT DEFAULT '#000000',
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL DEFAULT 0,
        deadline DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        category TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
        next_date DATETIME NOT NULL,
        paused INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        user_agent TEXT,
        ip_address TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS job_locks (
        lock_name TEXT PRIMARY KEY,
        holder_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ], 'write');

    // Lightweight migrations for existing local/hosted DBs.
    const migrationStatements = [
      `ALTER TABLE recurring_transactions ADD COLUMN paused INTEGER DEFAULT 0`,
      `ALTER TABLE refresh_tokens ADD COLUMN user_agent TEXT`,
      `ALTER TABLE refresh_tokens ADD COLUMN ip_address TEXT`,
      `CREATE TABLE IF NOT EXISTS job_locks (
        lock_name TEXT PRIMARY KEY,
        holder_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date ON transactions(user_id, category, date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_budgets_user_month_category ON budgets(user_id, month, category)`,
      `CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_categories_user_type_name ON categories(user_id, type, name)`,
      `CREATE INDEX IF NOT EXISTS idx_recurring_user_paused_nextdate ON recurring_transactions(user_id, paused, next_date)`,
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked_expires ON refresh_tokens(user_id, revoked_at, expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_job_locks_expires_at ON job_locks(expires_at)`,
    ];

    for (const sql of migrationStatements) {
      try {
        await db.execute({ sql, args: [] });
      } catch (migrationErr) {
        // Ignore duplicate-column style migration errors.
        const msg = String(migrationErr.message || '').toLowerCase();
        const ignorable = msg.includes('duplicate') || msg.includes('already exists');
        if (!ignorable) {
          console.warn('Migration warning:', migrationErr.message);
        }
      }
    }
    
    console.log('Database tables verified.');
  } catch (error) {
    console.error('Error setting up Turso DB:', error.message);
  }
};

module.exports = { db, connectDB };

