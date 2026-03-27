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
        mobile_number TEXT UNIQUE,
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
      `CREATE TABLE IF NOT EXISTS net_worth_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('asset', 'liability')),
        value REAL NOT NULL,
        category TEXT,
        as_of DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS automation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        field TEXT NOT NULL CHECK(field IN ('title', 'category', 'amount', 'type')),
        operator TEXT NOT NULL CHECK(operator IN ('contains', 'equals', 'gt', 'lt')),
        value TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK(action_type IN ('set_category', 'set_type', 'set_title')),
        action_value TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_day INTEGER NOT NULL,
        category TEXT,
        active INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS households (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS household_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(household_id, user_id),
        FOREIGN KEY (household_id) REFERENCES households(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        monthly_savings_boost REAL DEFAULT 0,
        expense_cut_pct REAL DEFAULT 0,
        months INTEGER DEFAULT 12,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        area TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        payload_json TEXT,
        prev_hash TEXT,
        entry_hash TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS mobile_otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile_number TEXT NOT NULL,
        purpose TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME,
        ip_address TEXT,
        user_agent TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS category_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        input_title TEXT NOT NULL,
        suggested_category TEXT,
        selected_category TEXT NOT NULL,
        confidence REAL DEFAULT 0,
        source TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS statement_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        source_label TEXT,
        total_rows INTEGER DEFAULT 0,
        duplicate_rows INTEGER DEFAULT 0,
        new_rows INTEGER DEFAULT 0,
        payload_json TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS household_spending_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        monthly_limit REAL NOT NULL,
        created_by INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(household_id, user_id),
        FOREIGN KEY (household_id) REFERENCES households(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS household_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL,
        requester_user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        title TEXT NOT NULL,
        category TEXT,
        note TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        decided_by INTEGER,
        decided_note TEXT,
        decided_at DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (household_id) REFERENCES households(id),
        FOREIGN KEY (requester_user_id) REFERENCES users(id),
        FOREIGN KEY (decided_by) REFERENCES users(id)
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
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_type_category_date ON transactions(user_id, type, category, date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_month_type ON transactions(user_id, strftime('%Y-%m', date), type)`,
      `CREATE INDEX IF NOT EXISTS idx_budgets_user_month_category ON budgets(user_id, month, category)`,
      `CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_categories_user_type_name ON categories(user_id, type, name)`,
      `CREATE INDEX IF NOT EXISTS idx_recurring_user_paused_nextdate ON recurring_transactions(user_id, paused, next_date)`,
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked_expires ON refresh_tokens(user_id, revoked_at, expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_job_locks_expires_at ON job_locks(expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_net_worth_user_kind_asof ON net_worth_items(user_id, kind, as_of DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_automation_rules_user_enabled ON automation_rules(user_id, enabled)`,
      `CREATE INDEX IF NOT EXISTS idx_bill_items_user_active_due ON bill_items(user_id, active, due_day)`,
      `CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_household_members_household_user ON household_members(household_id, user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_scenarios_user_created ON scenarios(user_id, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_user_area_action ON activity_logs(user_id, area, action, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_user_entity_created ON activity_logs(user_id, entity_type, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_user_entry_hash ON activity_logs(user_id, entry_hash)`,
      `ALTER TABLE activity_logs ADD COLUMN prev_hash TEXT`,
      `ALTER TABLE activity_logs ADD COLUMN entry_hash TEXT`,
      `ALTER TABLE users ADD COLUMN mobile_number TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number)`,
      `CREATE INDEX IF NOT EXISTS idx_mobile_otp_mobile_purpose_created ON mobile_otp_codes(mobile_number, purpose, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mobile_otp_expires_consumed ON mobile_otp_codes(expires_at, consumed_at)`,
      `CREATE INDEX IF NOT EXISTS idx_category_feedback_user_title_created ON category_feedback(user_id, input_title, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_statement_reconciliations_user_created ON statement_reconciliations(user_id, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_household_limits_household_user ON household_spending_limits(household_id, user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_household_approvals_household_status_created ON household_approvals(household_id, status, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_household_approvals_requester_created ON household_approvals(requester_user_id, createdAt DESC)`,
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

