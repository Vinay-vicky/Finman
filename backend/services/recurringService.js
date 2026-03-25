const { db } = require('../database');

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
    sql: `INSERT INTO recurring_transactions (user_id, title, amount, type, category, frequency, next_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      data.title,
      data.amount,
      data.type,
      data.category,
      data.frequency,
      data.next_date || new Date().toISOString(),
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
          SET title = ?, amount = ?, type = ?, category = ?, frequency = ?, next_date = ?
          WHERE id = ? AND user_id = ?`,
    args: [
      data.title,
      data.amount,
      data.type,
      data.category,
      data.frequency,
      data.next_date,
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
          WHERE user_id = ? AND datetime(next_date) <= datetime(?)
          ORDER BY next_date ASC`,
    args: [userId, untilIso],
  });

  let created = 0;

  for (const row of due.rows) {
    // Safety limit prevents runaway loops if data is malformed.
    const maxIterations = Math.max(1, Math.ceil(730 / (frequencyDays[row.frequency] || 1)));
    let cursor = new Date(row.next_date);
    let iterations = 0;

    while (cursor <= untilDate && iterations < maxIterations) {
      await db.execute({
        sql: `INSERT INTO transactions (user_id, title, amount, type, category, date)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [row.user_id, row.title, row.amount, row.type, row.category, cursor.toISOString()],
      });
      created += 1;
      cursor = addFrequency(cursor, row.frequency);
      iterations += 1;
    }

    await db.execute({
      sql: 'UPDATE recurring_transactions SET next_date = ? WHERE id = ? AND user_id = ?',
      args: [cursor.toISOString(), row.id, userId],
    });
  }

  return { created };
};

module.exports = {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  materializeDueRecurring,
};
