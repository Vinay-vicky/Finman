const { db } = require('../database');
const { clearAnalyticsCacheForUser } = require('./analyticsService');

const RECURRING_JOB_LOCK_NAME = 'recurring_materialize_job';

const frequencyDays = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

const toIso = (date) => new Date(date).toISOString();

const addFrequency = (date, frequency) => {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next;
};

const listRecurring = async (userId) => {
  const result = await db.execute({
    sql: 'SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY next_date ASC',
    args: [userId],
  });
  return result.rows;
};

const createRecurring = async (userId, data) => {
  const result = await db.execute({
    sql: `INSERT INTO recurring_transactions (user_id, title, amount, type, category, frequency, next_date, paused)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      data.title,
      data.amount,
      data.type,
      data.category,
      data.frequency,
      data.next_date || new Date().toISOString(),
      data.paused ? 1 : 0,
    ],
  });

  const inserted = await db.execute({
    sql: 'SELECT * FROM recurring_transactions WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });

  return inserted.rows[0];
};

const updateRecurring = async (userId, id, data) => {
  const result = await db.execute({
    sql: `UPDATE recurring_transactions
          SET title = ?, amount = ?, type = ?, category = ?, frequency = ?, next_date = ?, paused = ?
          WHERE id = ? AND user_id = ?`,
    args: [
      data.title,
      data.amount,
      data.type,
      data.category,
      data.frequency,
      data.next_date,
      data.paused ? 1 : 0,
      id,
      userId,
    ],
  });

  if (result.rowsAffected === 0) {
    throw new Error('Recurring transaction not found or unauthorized.');
  }

  const updated = await db.execute({
    sql: 'SELECT * FROM recurring_transactions WHERE id = ?',
    args: [id],
  });

  return updated.rows[0];
};

const deleteRecurring = async (userId, id) => {
  const result = await db.execute({
    sql: 'DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (result.rowsAffected === 0) {
    throw new Error('Recurring transaction not found or unauthorized.');
  }
};

const materializeDueRecurring = async (userId, untilDate = new Date()) => {
  const untilIso = toIso(untilDate);
  const due = await db.execute({
    sql: `SELECT * FROM recurring_transactions
          WHERE user_id = ? AND COALESCE(paused, 0) = 0 AND datetime(next_date) <= datetime(?)
          ORDER BY next_date ASC`,
    args: [userId, untilIso],
  });

  let created = 0;
  const statements = [];

  for (const row of due.rows) {
    // Safety limit prevents runaway loops if data is malformed.
    const maxIterations = Math.max(1, Math.ceil(730 / (frequencyDays[row.frequency] || 1)));
    let cursor = new Date(row.next_date);
    let iterations = 0;

    while (cursor <= untilDate && iterations < maxIterations) {
      statements.push({
        sql: `INSERT INTO transactions (user_id, title, amount, type, category, date)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [row.user_id, row.title, row.amount, row.type, row.category, cursor.toISOString()],
      });
      created += 1;
      cursor = addFrequency(cursor, row.frequency);
      iterations += 1;
    }

    statements.push({
      sql: 'UPDATE recurring_transactions SET next_date = ? WHERE id = ? AND user_id = ?',
      args: [cursor.toISOString(), row.id, userId],
    });
  }

  if (statements.length > 0) {
    await db.batch(statements, 'write');
    clearAnalyticsCacheForUser(userId);
  }

  return { created };
};

const materializeDueRecurringForAllUsers = async (untilDate = new Date()) => {
  const untilIso = toIso(untilDate);
  const usersResult = await db.execute({
    sql: `SELECT DISTINCT user_id
          FROM recurring_transactions
          WHERE COALESCE(paused, 0) = 0 AND datetime(next_date) <= datetime(?)`,
    args: [untilIso],
  });

  let created = 0;
  let usersProcessed = 0;

  for (const row of usersResult.rows) {
    const userId = row.user_id;
    const result = await materializeDueRecurring(userId, untilDate);
    created += Number(result.created) || 0;
    usersProcessed += 1;
  }

  return { usersProcessed, created };
};

const tryAcquireRecurringJobLease = async (holderId, leaseMs = 120000) => {
  if (!holderId) {
    throw new Error('holderId is required to acquire recurring job lease.');
  }

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + Math.max(1000, leaseMs)).toISOString();

  const result = await db.execute({
    sql: `INSERT INTO job_locks (lock_name, holder_id, expires_at, updatedAt)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(lock_name) DO UPDATE SET
            holder_id = excluded.holder_id,
            expires_at = excluded.expires_at,
            updatedAt = CURRENT_TIMESTAMP
          WHERE datetime(job_locks.expires_at) <= datetime(?) OR job_locks.holder_id = ?`,
    args: [RECURRING_JOB_LOCK_NAME, holderId, expiresIso, nowIso, holderId],
  });

  return {
    acquired: Number(result.rowsAffected) > 0,
    lockName: RECURRING_JOB_LOCK_NAME,
    holderId,
    expiresAt: expiresIso,
  };
};

module.exports = {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  materializeDueRecurring,
  materializeDueRecurringForAllUsers,
  tryAcquireRecurringJobLease,
};
