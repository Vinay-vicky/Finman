const { db } = require('../database');
const recurringService = require('./recurringService');
const { clearAnalyticsCacheForUser } = require('./analyticsService');

const appendDateFilters = (query, args, filters) => {
  if (filters.from) {
    query += ' AND datetime(date) >= datetime(?)';
    args.push(filters.from);
  }
  if (filters.to) {
    query += ' AND datetime(date) <= datetime(?)';
    args.push(filters.to);
  }
  return query;
};

const getTransactions = async (userId, filters) => {
  await recurringService.materializeDueRecurring(userId, new Date());

  const { search, category, type, sort = 'date', order = 'desc', limit = 50, offset = 0, paginate } = filters;

  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const args = [userId];

  if (search) {
    query += ' AND title LIKE ?';
    args.push(`%${search}%`);
  }
  if (category) {
    query += ' AND category = ?';
    args.push(category);
  }
  if (type) {
    query += ' AND type = ?';
    args.push(type);
  }

  query = appendDateFilters(query, args, filters);

  const allowedSorts = ['date', 'amount', 'title'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'date';
  const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
  args.push(Number(limit), Number(offset));

  if (paginate === 'true') {
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?';
    const countArgs = [userId];
    if (search) { countQuery += ' AND title LIKE ?'; countArgs.push(`%${search}%`); }
    if (category) { countQuery += ' AND category = ?'; countArgs.push(category); }
    if (type) { countQuery += ' AND type = ?'; countArgs.push(type); }
    countQuery = appendDateFilters(countQuery, countArgs, filters);

    const countResult = await db.execute({ sql: countQuery, args: countArgs });
    const total = Number(countResult.rows[0].total);

    const result = await db.execute({ sql: query, args });

    return {
      data: result.rows,
      total,
      page: Math.floor(Number(offset) / Number(limit)) + 1,
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  const result = await db.execute({ sql: query, args });
  return result.rows;
};

const getAllTransactionsForExport = async (userId, filters = {}) => {
  let sql = 'SELECT title, amount, type, category, date FROM transactions WHERE user_id = ?';
  const args = [userId];
  sql = appendDateFilters(sql, args, filters);
  sql += ' ORDER BY date DESC';

  const result = await db.execute({ sql, args });
  return result.rows;
};

const createTransaction = async (userId, data) => {
  const result = await db.execute({
    sql: 'INSERT INTO transactions (user_id, title, amount, type, category, date) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))',
    args: [userId, data.title, data.amount, data.type, data.category, data.date || null],
  });
  const newTx = await db.execute({ sql: 'SELECT * FROM transactions WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  clearAnalyticsCacheForUser(userId);
  return newTx.rows[0];
};

const updateTransaction = async (userId, transactionId, data) => {
  const result = await db.execute({
    sql: 'UPDATE transactions SET title = ?, amount = ?, type = ?, category = ?, date = ? WHERE id = ? AND user_id = ?',
    args: [data.title, data.amount, data.type, data.category, data.date || null, transactionId, userId],
  });
  if (result.rowsAffected === 0) {
    throw new Error('Transaction not found or unauthorized.');
  }
  const updatedTx = await db.execute({ sql: 'SELECT * FROM transactions WHERE id = ?', args: [transactionId] });
  clearAnalyticsCacheForUser(userId);
  return updatedTx.rows[0];
};

const deleteTransaction = async (userId, transactionId) => {
  const result = await db.execute({
    sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
    args: [transactionId, userId],
  });
  if (result.rowsAffected === 0) {
    throw new Error('Transaction not found or unauthorized.');
  }
  clearAnalyticsCacheForUser(userId);
  return result;
};

module.exports = {
  getTransactions,
  getAllTransactionsForExport,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
