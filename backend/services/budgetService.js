const { db } = require('../database');

const getBudgets = async (userId) => {
  const result = await db.execute({ sql: 'SELECT * FROM budgets WHERE user_id = ? ORDER BY month DESC', args: [userId] });
  return result.rows;
};

const createBudget = async (userId, data) => {
  const result = await db.execute({
    sql: 'INSERT INTO budgets (user_id, category, amount, month) VALUES (?, ?, ?, ?)',
    args: [userId, data.category, data.amount, data.month]
  });
  const newBudget = await db.execute({ sql: 'SELECT * FROM budgets WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return newBudget.rows[0];
};

const deleteBudget = async (userId, budgetId) => {
  const result = await db.execute({
    sql: 'DELETE FROM budgets WHERE id = ? AND user_id = ?',
    args: [budgetId, userId]
  });
  if (result.rowsAffected === 0) {
    throw new Error('Budget not found or unauthorized.');
  }
  return result;
};

module.exports = {
  getBudgets,
  createBudget,
  deleteBudget,
};
