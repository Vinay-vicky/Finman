const { db } = require('../database');

const getSummary = async (userId) => {
  const result = await db.execute({
    sql: 'SELECT type, SUM(amount) as total FROM transactions WHERE user_id = ? GROUP BY type',
    args: [userId]
  });
  
  const summary = { income: 0, expense: 0, balance: 0 };
  result.rows.forEach(row => {
    if (row.type === 'income') summary.income += row.total;
    if (row.type === 'expense') summary.expense += row.total;
  });
  summary.balance = summary.income - summary.expense;
  return summary;
};

const getCategoryCharts = async (userId) => {
  const result = await db.execute({
    sql: 'SELECT category as name, SUM(amount) as value, type FROM transactions WHERE user_id = ? AND type = "expense" GROUP BY category',
    args: [userId]
  });
  return result.rows;
};

module.exports = {
  getSummary,
  getCategoryCharts,
};
