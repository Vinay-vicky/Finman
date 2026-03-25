const { db } = require('../database');

const buildDateWhere = (from, to, args, dateColumn = 'date') => {
  let where = '';

  if (from) {
    where += ` AND datetime(${dateColumn}) >= datetime(?)`;
    args.push(from);
  }

  if (to) {
    where += ` AND datetime(${dateColumn}) <= datetime(?)`;
    args.push(to);
  }

  return where;
};

const getSummary = async (userId, range = {}) => {
  const args = [userId];
  const dateWhere = buildDateWhere(range.from, range.to, args);

  const result = await db.execute({
    sql: `SELECT type, SUM(amount) as total
          FROM transactions
          WHERE user_id = ? ${dateWhere}
          GROUP BY type`,
    args,
  });

  const summary = { income: 0, expense: 0, balance: 0 };
  result.rows.forEach((row) => {
    const total = Number(row.total) || 0;
    if (row.type === 'income') summary.income += total;
    if (row.type === 'expense') summary.expense += total;
  });
  summary.balance = summary.income - summary.expense;
  return summary;
};

const getCategoryCharts = async (userId, range = {}) => {
  const args = [userId];
  const dateWhere = buildDateWhere(range.from, range.to, args);

  const result = await db.execute({
    sql: `SELECT category as name, SUM(amount) as value, type
          FROM transactions
          WHERE user_id = ? AND type = 'expense' ${dateWhere}
          GROUP BY category`,
    args,
  });

  return result.rows.map((row) => ({
    ...row,
    value: Number(row.value) || 0,
  }));
};

const getComparison = async (userId, range = {}) => {
  if (!range.from || !range.to) {
    return {
      current: await getSummary(userId, {}),
      previous: { income: 0, expense: 0, balance: 0 },
      deltaPercent: { income: 0, expense: 0, balance: 0 },
    };
  }

  const from = new Date(range.from);
  const to = new Date(range.to);
  const durationMs = Math.max(24 * 60 * 60 * 1000, to.getTime() - from.getTime());

  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  const current = await getSummary(userId, { from: from.toISOString(), to: to.toISOString() });
  const previous = await getSummary(userId, { from: prevFrom.toISOString(), to: prevTo.toISOString() });

  const pct = (cur, prev) => {
    if (!prev) return cur === 0 ? 0 : 100;
    return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(2));
  };

  return {
    current,
    previous,
    deltaPercent: {
      income: pct(current.income, previous.income),
      expense: pct(current.expense, previous.expense),
      balance: pct(current.balance, previous.balance),
    },
  };
};

const getReport = async (userId, range = {}) => {
  const [summary, categories] = await Promise.all([
    getSummary(userId, range),
    getCategoryCharts(userId, range),
  ]);

  const args = [userId];
  const dateWhere = buildDateWhere(range.from, range.to, args);
  const trend = await db.execute({
    sql: `SELECT strftime('%Y-%m', date) as month,
                 SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                 SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
          FROM transactions
          WHERE user_id = ? ${dateWhere}
          GROUP BY strftime('%Y-%m', date)
          ORDER BY month ASC`,
    args,
  });

  return {
    range,
    summary,
    categories,
    monthlyTrend: trend.rows.map((r) => ({
      month: r.month,
      income: Number(r.income) || 0,
      expense: Number(r.expense) || 0,
    })),
  };
};

module.exports = {
  getSummary,
  getCategoryCharts,
  getComparison,
  getReport,
};
