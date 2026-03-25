const { db } = require('../database');
const logger = require('../utils/logger');

const ANALYTICS_CACHE_TTL_MS = Number(process.env.ANALYTICS_CACHE_TTL_MS || 30_000);
const ANALYTICS_CACHE_MAX_ENTRIES = Number(process.env.ANALYTICS_CACHE_MAX_ENTRIES || 500);
const ANALYTICS_SLOW_QUERY_MS = Number(process.env.ANALYTICS_SLOW_QUERY_MS || 250);
const ANALYTICS_LOG_ALL_TIMINGS = String(process.env.ANALYTICS_LOG_ALL_TIMINGS || 'false').toLowerCase() === 'true';
const analyticsCache = new Map();
const analyticsMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  expiredRemovals: 0,
  userInvalidations: 0,
};

const serializeRange = (range = {}) => `${range.from || ''}|${range.to || ''}`;
const makeCacheKey = (kind, userId, range = {}) => `${kind}:${userId}:${serializeRange(range)}`;

const getCached = (key) => {
  const hit = analyticsCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    analyticsMetrics.expiredRemovals += 1;
    analyticsCache.delete(key);
    return null;
  }
  // Touch for LRU semantics.
  analyticsCache.delete(key);
  analyticsCache.set(key, hit);
  return hit.value;
};

const setCached = (key, value) => {
  if (analyticsCache.has(key)) {
    analyticsCache.delete(key);
  }

  analyticsCache.set(key, {
    value,
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
  });

  while (analyticsCache.size > ANALYTICS_CACHE_MAX_ENTRIES) {
    const oldestKey = analyticsCache.keys().next().value;
    if (oldestKey === undefined) break;
    analyticsMetrics.evictions += 1;
    analyticsCache.delete(oldestKey);
  }
};

const logTiming = (kind, userId, durationMs, cacheStatus) => {
  if (!ANALYTICS_LOG_ALL_TIMINGS && durationMs < ANALYTICS_SLOW_QUERY_MS) return;
  logger.info('Analytics timing', {
    kind,
    userId,
    durationMs,
    cacheStatus,
  });
};

const withCache = async (kind, userId, range, producer) => {
  const startedAt = Date.now();
  const key = makeCacheKey(kind, userId, range);
  const cached = getCached(key);
  if (cached !== null) {
    analyticsMetrics.hits += 1;
    logTiming(kind, userId, Date.now() - startedAt, 'hit');
    return cached;
  }

  analyticsMetrics.misses += 1;
  const fresh = await producer();
  setCached(key, fresh);
  logTiming(kind, userId, Date.now() - startedAt, 'miss');
  return fresh;
};

const clearAnalyticsCacheForUser = (userId) => {
  const prefix = `:${userId}:`;
  let removed = 0;
  for (const key of analyticsCache.keys()) {
    if (key.includes(prefix)) {
      analyticsCache.delete(key);
      removed += 1;
    }
  }
  if (removed > 0) analyticsMetrics.userInvalidations += 1;
};

const getAnalyticsCacheMetrics = () => {
  const totalLookups = analyticsMetrics.hits + analyticsMetrics.misses;
  return {
    ttlMs: ANALYTICS_CACHE_TTL_MS,
    maxEntries: ANALYTICS_CACHE_MAX_ENTRIES,
    size: analyticsCache.size,
    hits: analyticsMetrics.hits,
    misses: analyticsMetrics.misses,
    hitRate: totalLookups === 0 ? 0 : Number((analyticsMetrics.hits / totalLookups).toFixed(4)),
    evictions: analyticsMetrics.evictions,
    expiredRemovals: analyticsMetrics.expiredRemovals,
    userInvalidations: analyticsMetrics.userInvalidations,
    slowQueryThresholdMs: ANALYTICS_SLOW_QUERY_MS,
    logAllTimings: ANALYTICS_LOG_ALL_TIMINGS,
  };
};

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
  return withCache('summary', userId, range, async () => {
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
  });
};

const getCategoryCharts = async (userId, range = {}) => {
  return withCache('categoryCharts', userId, range, async () => {
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
  });
};

const getComparison = async (userId, range = {}) => {
  return withCache('comparison', userId, range, async () => {
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
  });
};

const getReport = async (userId, range = {}) => {
  return withCache('report', userId, range, async () => {
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
  });
};

module.exports = {
  getSummary,
  getCategoryCharts,
  getComparison,
  getReport,
  clearAnalyticsCacheForUser,
  getAnalyticsCacheMetrics,
};
