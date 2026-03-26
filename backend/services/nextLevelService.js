const crypto = require('crypto');
const { db } = require('../database');

const toNumber = (v) => Number(v || 0);
const getPagination = (query = {}) => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const toPaginated = (items, total, page, limit) => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

const logActivity = async (userId, area, action, entityType, entityId, payload = {}) => {
  try {
    const payloadJson = JSON.stringify(payload || {});
    const previous = await db.execute({
      sql: 'SELECT entry_hash AS entryHash FROM activity_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      args: [userId],
    });
    const prevHash = previous.rows[0]?.entryHash || '';
    const entryHash = crypto
      .createHash('sha256')
      .update(`${userId}|${area}|${action}|${entityType || ''}|${entityId || ''}|${payloadJson}|${prevHash}`)
      .digest('hex');

    await db.execute({
      sql: `INSERT INTO activity_logs (user_id, area, action, entity_type, entity_id, payload_json, prev_hash, entry_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, area, action, entityType || null, entityId || null, payloadJson, prevHash || null, entryHash],
    });
  } catch {
    // Logging failures should never block main flow.
  }
};

const getMonthlySeries = async (userId, months = 6) => {
  const result = await db.execute({
    sql: `
      SELECT
        strftime('%Y-%m', date) AS month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
      FROM transactions
      WHERE user_id = ?
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
      LIMIT ?
    `,
    args: [userId, months],
  });

  return [...result.rows].reverse().map((row) => ({
    month: row.month,
    income: toNumber(row.income),
    expense: toNumber(row.expense),
    net: toNumber(row.income) - toNumber(row.expense),
  }));
};

const getCopilotSummary = async (userId) => {
  const monthly = await getMonthlySeries(userId, 2);
  const current = monthly[monthly.length - 1] || { income: 0, expense: 0, net: 0 };
  const previous = monthly[monthly.length - 2] || { income: 0, expense: 0, net: 0 };

  const topCategory = await db.execute({
    sql: `
      SELECT category, SUM(amount) AS total
      FROM transactions
      WHERE user_id = ? AND type = 'expense'
      GROUP BY category
      ORDER BY total DESC
      LIMIT 1
    `,
    args: [userId],
  });

  const delta = current.net - previous.net;
  const headline =
    current.net >= 0
      ? `Nice work — you're cashflow positive by ${current.net.toFixed(2)} this month.`
      : `Heads up — you're ${Math.abs(current.net).toFixed(2)} in the red this month.`;

  const recommendation =
    current.expense > current.income
      ? 'Reduce discretionary spending by 10% and review subscriptions.'
      : 'Auto-allocate part of surplus to your highest-priority goal.';

  return {
    headline,
    stats: {
      income: current.income,
      expense: current.expense,
      net: current.net,
      deltaVsLastMonth: delta,
      topExpenseCategory: topCategory.rows[0]?.category || 'N/A',
    },
    recommendation,
  };
};

const getCashflowForecast = async (userId, months = 6) => {
  const history = await getMonthlySeries(userId, 6);
  const avgNet = history.length ? history.reduce((acc, m) => acc + m.net, 0) / history.length : 0;

  const balanceQuery = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
      FROM transactions
      WHERE user_id = ?
    `,
    args: [userId],
  });

  const currentBalance = toNumber(balanceQuery.rows[0]?.income) - toNumber(balanceQuery.rows[0]?.expense);
  const projection = [];
  for (let i = 1; i <= months; i += 1) {
    projection.push({
      monthOffset: i,
      projectedNet: Number(avgNet.toFixed(2)),
      projectedBalance: Number((currentBalance + avgNet * i).toFixed(2)),
    });
  }

  return {
    averageMonthlyNet: Number(avgNet.toFixed(2)),
    currentBalance: Number(currentBalance.toFixed(2)),
    projection,
  };
};

const getAnomalies = async (userId) => {
  const rows = await db.execute({
    sql: `
      SELECT id, title, amount, category, date
      FROM transactions
      WHERE user_id = ? AND type = 'expense'
      ORDER BY date DESC
      LIMIT 400
    `,
    args: [userId],
  });

  const values = rows.rows.map((r) => toNumber(r.amount));
  if (values.length < 5) {
    return { threshold: null, anomalies: [] };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  const threshold = mean + stdev * 2;

  const anomalies = rows.rows.filter((r) => toNumber(r.amount) >= threshold).slice(0, 15);

  return {
    threshold: Number(threshold.toFixed(2)),
    anomalies,
  };
};

const getSubscriptionsInsights = async (userId) => {
  const rows = await db.execute({
    sql: `
      SELECT LOWER(TRIM(title)) AS normalized_title, title, category, COUNT(*) AS count, AVG(amount) AS avg_amount
      FROM transactions
      WHERE user_id = ? AND type = 'expense'
      GROUP BY LOWER(TRIM(title)), category
      HAVING COUNT(*) >= 2
      ORDER BY count DESC, avg_amount DESC
      LIMIT 30
    `,
    args: [userId],
  });

  const candidates = rows.rows
    .filter((r) => toNumber(r.avg_amount) > 0)
    .map((r) => ({
      title: r.title,
      category: r.category,
      occurrences: toNumber(r.count),
      avgAmount: Number(toNumber(r.avg_amount).toFixed(2)),
      estimatedMonthlyImpact: Number(toNumber(r.avg_amount).toFixed(2)),
    }));

  return { candidates };
};

const listNetWorthItems = async (userId, query = {}) => {
  const { page, limit, offset } = getPagination(query);
  const where = ['user_id = ?'];
  const args = [userId];

  if (query.kind) {
    where.push('kind = ?');
    args.push(query.kind);
  }
  if (query.search) {
    where.push('LOWER(name) LIKE ?');
    args.push(`%${String(query.search).toLowerCase()}%`);
  }

  const whereSql = where.join(' AND ');
  const result = await db.execute({
    sql: `SELECT * FROM net_worth_items WHERE ${whereSql} ORDER BY as_of DESC, id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const count = await db.execute({
    sql: `SELECT COUNT(*) as total FROM net_worth_items WHERE ${whereSql}`,
    args,
  });
  const total = Number(count.rows[0]?.total || 0);

  const assets = result.rows.filter((r) => r.kind === 'asset').reduce((a, r) => a + toNumber(r.value), 0);
  const liabilities = result.rows.filter((r) => r.kind === 'liability').reduce((a, r) => a + toNumber(r.value), 0);

  return {
    ...toPaginated(result.rows, total, page, limit),
    totals: {
      assets: Number(assets.toFixed(2)),
      liabilities: Number(liabilities.toFixed(2)),
      netWorth: Number((assets - liabilities).toFixed(2)),
    },
  };
};

const upsertNetWorthItem = async (userId, payload) => {
  if (payload.id) {
    const before = await db.execute({
      sql: 'SELECT * FROM net_worth_items WHERE id = ? AND user_id = ?',
      args: [payload.id, userId],
    });

    await db.execute({
      sql: 'UPDATE net_worth_items SET name = ?, kind = ?, value = ?, category = ?, as_of = COALESCE(?, as_of) WHERE id = ? AND user_id = ?',
      args: [payload.name, payload.kind, payload.value, payload.category || null, payload.as_of || null, payload.id, userId],
    });
    const result = await db.execute({ sql: 'SELECT * FROM net_worth_items WHERE id = ? AND user_id = ?', args: [payload.id, userId] });
    await logActivity(userId, 'next-level', 'update', 'networth', payload.id, {
      before: before.rows[0] || null,
      after: result.rows[0] || null,
    });
    return result.rows[0];
  }

  const insert = await db.execute({
    sql: 'INSERT INTO net_worth_items (user_id, name, kind, value, category, as_of) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))',
    args: [userId, payload.name, payload.kind, payload.value, payload.category || null, payload.as_of || null],
  });

  const created = await db.execute({
    sql: 'SELECT * FROM net_worth_items WHERE id = ?',
    args: [Number(insert.lastInsertRowid)],
  });
  await logActivity(userId, 'next-level', 'create', 'networth', Number(insert.lastInsertRowid), {
    name: payload.name,
    kind: payload.kind,
    value: payload.value,
  });
  return created.rows[0];
};

const deleteNetWorthItem = async (userId, id) => {
  await db.execute({
    sql: 'DELETE FROM net_worth_items WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  await logActivity(userId, 'next-level', 'delete', 'networth', id, {});
  return { id };
};

const evaluateScenario = async (userId, payload) => {
  const forecast = await getCashflowForecast(userId, Number(payload.months) || 12);
  const currentMonthlyNet = toNumber(forecast.averageMonthlyNet);
  const monthlySavingsBoost = toNumber(payload.monthlySavingsBoost);
  const expenseCutPct = Math.max(0, Math.min(100, toNumber(payload.expenseCutPct)));

  const adjustedNet = currentMonthlyNet + monthlySavingsBoost + currentMonthlyNet * (expenseCutPct / 100);
  const months = Number(payload.months) || 12;

  return {
    baseMonthlyNet: Number(currentMonthlyNet.toFixed(2)),
    adjustedMonthlyNet: Number(adjustedNet.toFixed(2)),
    projectedGain: Number((adjustedNet * months).toFixed(2)),
    months,
  };
};

const listRules = async (userId, query = {}) => {
  const { page, limit, offset } = getPagination(query);
  const where = ['user_id = ?'];
  const args = [userId];

  if (query.search) {
    where.push('LOWER(name) LIKE ?');
    args.push(`%${String(query.search).toLowerCase()}%`);
  }

  const whereSql = where.join(' AND ');
  const result = await db.execute({
    sql: `SELECT * FROM automation_rules WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  const count = await db.execute({
    sql: `SELECT COUNT(*) as total FROM automation_rules WHERE ${whereSql}`,
    args,
  });

  return toPaginated(result.rows, Number(count.rows[0]?.total || 0), page, limit);
};

const createRule = async (userId, payload) => {
  if (payload.id) {
    const before = await db.execute({
      sql: 'SELECT * FROM automation_rules WHERE id = ? AND user_id = ?',
      args: [payload.id, userId],
    });

    await db.execute({
      sql: 'UPDATE automation_rules SET name = ?, field = ?, operator = ?, value = ?, action_type = ?, action_value = ?, enabled = ? WHERE id = ? AND user_id = ?',
      args: [
        payload.name,
        payload.field,
        payload.operator,
        String(payload.value),
        payload.action_type,
        String(payload.action_value),
        payload.enabled === false ? 0 : 1,
        payload.id,
        userId,
      ],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM automation_rules WHERE id = ? AND user_id = ?',
      args: [payload.id, userId],
    });
    await logActivity(userId, 'next-level', 'update', 'rule', payload.id, {
      before: before.rows[0] || null,
      after: updated.rows[0] || null,
    });
    return updated.rows[0];
  }

  const result = await db.execute({
    sql: 'INSERT INTO automation_rules (user_id, name, field, operator, value, action_type, action_value, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      userId,
      payload.name,
      payload.field,
      payload.operator,
      String(payload.value),
      payload.action_type,
      String(payload.action_value),
      payload.enabled === false ? 0 : 1,
    ],
  });

  const created = await db.execute({ sql: 'SELECT * FROM automation_rules WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  await logActivity(userId, 'next-level', 'create', 'rule', Number(result.lastInsertRowid), {
    name: payload.name,
    field: payload.field,
    operator: payload.operator,
  });
  return created.rows[0];
};

const deleteRule = async (userId, id) => {
  await db.execute({
    sql: 'DELETE FROM automation_rules WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  await logActivity(userId, 'next-level', 'delete', 'rule', id, {});
  return { id };
};

const simulateRules = async (userId, sample) => {
  const rulesResult = await listRules(userId, { page: 1, limit: 100 });
  const rules = rulesResult.items || [];
  const tx = { ...sample };
  const applied = [];

  for (const rule of rules.filter((r) => Number(r.enabled) === 1)) {
    const fieldValue = String(tx[rule.field] ?? '');
    const ruleValue = String(rule.value ?? '');
    let matches = false;

    if (rule.operator === 'contains') matches = fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    if (rule.operator === 'equals') matches = fieldValue.toLowerCase() === ruleValue.toLowerCase();
    if (rule.operator === 'gt') matches = Number(fieldValue) > Number(ruleValue);
    if (rule.operator === 'lt') matches = Number(fieldValue) < Number(ruleValue);

    if (matches) {
      if (rule.action_type === 'set_category') tx.category = rule.action_value;
      if (rule.action_type === 'set_type') tx.type = rule.action_value;
      if (rule.action_type === 'set_title') tx.title = rule.action_value;
      applied.push({ id: rule.id, name: rule.name });
    }
  }

  return { transformed: tx, applied };
};

const listBills = async (userId, query = {}) => {
  const { page, limit, offset } = getPagination(query);
  const where = ['user_id = ?'];
  const args = [userId];

  if (query.active === 'true') {
    where.push('active = 1');
  }
  if (query.active === 'false') {
    where.push('active = 0');
  }
  if (query.search) {
    where.push('LOWER(name) LIKE ?');
    args.push(`%${String(query.search).toLowerCase()}%`);
  }

  const whereSql = where.join(' AND ');
  const result = await db.execute({
    sql: `SELECT * FROM bill_items WHERE ${whereSql} ORDER BY due_day ASC, id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  const count = await db.execute({
    sql: `SELECT COUNT(*) as total FROM bill_items WHERE ${whereSql}`,
    args,
  });

  return toPaginated(result.rows, Number(count.rows[0]?.total || 0), page, limit);
};

const upsertBill = async (userId, payload) => {
  if (payload.id) {
    const before = await db.execute({
      sql: 'SELECT * FROM bill_items WHERE id = ? AND user_id = ?',
      args: [payload.id, userId],
    });

    await db.execute({
      sql: 'UPDATE bill_items SET name = ?, amount = ?, due_day = ?, category = ?, active = ? WHERE id = ? AND user_id = ?',
      args: [payload.name, payload.amount, payload.due_day, payload.category || null, payload.active === false ? 0 : 1, payload.id, userId],
    });
    const updated = await db.execute({ sql: 'SELECT * FROM bill_items WHERE id = ? AND user_id = ?', args: [payload.id, userId] });
    await logActivity(userId, 'next-level', 'update', 'bill', payload.id, {
      before: before.rows[0] || null,
      after: updated.rows[0] || null,
    });
    return updated.rows[0];
  }

  const insert = await db.execute({
    sql: 'INSERT INTO bill_items (user_id, name, amount, due_day, category, active) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, payload.name, payload.amount, payload.due_day, payload.category || null, payload.active === false ? 0 : 1],
  });

  const created = await db.execute({ sql: 'SELECT * FROM bill_items WHERE id = ?', args: [Number(insert.lastInsertRowid)] });
  await logActivity(userId, 'next-level', 'create', 'bill', Number(insert.lastInsertRowid), {
    name: payload.name,
    amount: payload.amount,
    due_day: payload.due_day,
  });
  return created.rows[0];
};

const deleteBill = async (userId, id) => {
  await db.execute({
    sql: 'DELETE FROM bill_items WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  await logActivity(userId, 'next-level', 'delete', 'bill', id, {});
  return { id };
};

const getUpcomingBills = async (userId, query = {}) => {
  const base = await listBills(userId, { ...query, active: 'true', page: 1, limit: 200 });
  const bills = base.items;
  const today = new Date();
  const day = today.getDate();
  const dueWithinDays = Math.max(1, Number(query.dueWithinDays || 31));

  const upcoming = bills
    .map((b) => {
      const dueDay = Number(b.due_day);
      let daysUntil = dueDay - day;
      if (daysUntil < 0) daysUntil += 30;
      return {
        ...b,
        daysUntil,
      };
    })
    .filter((b) => b.daysUntil <= dueWithinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 25);

  return upcoming;
};

const listHouseholds = async (userId, query = {}) => {
  const { page, limit, offset } = getPagination(query);
  const search = String(query.search || '').trim().toLowerCase();

  const result = await db.execute({
    sql: `
      SELECT h.*
      FROM households h
      LEFT JOIN household_members hm ON hm.household_id = h.id
      WHERE (h.owner_user_id = ? OR hm.user_id = ?)
        AND (? = '' OR LOWER(h.name) LIKE ?)
      GROUP BY h.id
      ORDER BY h.id DESC
      LIMIT ? OFFSET ?
    `,
    args: [userId, userId, search, `%${search}%`, limit, offset],
  });
  const count = await db.execute({
    sql: `
      SELECT COUNT(*) as total
      FROM (
        SELECT h.id
        FROM households h
        LEFT JOIN household_members hm ON hm.household_id = h.id
        WHERE (h.owner_user_id = ? OR hm.user_id = ?)
          AND (? = '' OR LOWER(h.name) LIKE ?)
        GROUP BY h.id
      ) t
    `,
    args: [userId, userId, search, `%${search}%`],
  });

  return toPaginated(result.rows, Number(count.rows[0]?.total || 0), page, limit);
};

const createHousehold = async (userId, payload) => {
  const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const insert = await db.execute({
    sql: 'INSERT INTO households (owner_user_id, name, invite_code) VALUES (?, ?, ?)',
    args: [userId, payload.name, inviteCode],
  });
  const householdId = Number(insert.lastInsertRowid);

  await db.execute({
    sql: 'INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)',
    args: [householdId, userId, 'owner'],
  });

  const created = await db.execute({ sql: 'SELECT * FROM households WHERE id = ?', args: [householdId] });
  await logActivity(userId, 'next-level', 'create', 'household', householdId, {
    name: payload.name,
    inviteCode,
  });
  return created.rows[0];
};

const joinHouseholdByInvite = async (userId, inviteCode) => {
  const household = await db.execute({
    sql: 'SELECT * FROM households WHERE invite_code = ?',
    args: [inviteCode],
  });
  const h = household.rows[0];
  if (!h) return null;

  await db.execute({
    sql: 'INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)',
    args: [h.id, userId, 'viewer'],
  });

  await logActivity(userId, 'next-level', 'join', 'household', h.id, {
    inviteCode,
    householdName: h.name,
  });

  return h;
};

const listActivityTimeline = async (userId, query = {}) => {
  const { page, limit, offset } = getPagination(query);
  const where = ['user_id = ?'];
  const args = [userId];

  if (query.action) {
    where.push('action = ?');
    args.push(String(query.action));
  }
  if (query.entityType) {
    where.push('entity_type = ?');
    args.push(String(query.entityType));
  }
  if (query.from) {
    where.push('datetime(createdAt) >= datetime(?)');
    args.push(String(query.from));
  }
  if (query.to) {
    where.push('datetime(createdAt) <= datetime(?)');
    args.push(String(query.to));
  }

  const whereSql = where.join(' AND ');
  const rows = await db.execute({
    sql: `
      SELECT id, area, action, entity_type AS entityType, entity_id AS entityId, payload_json AS payloadJson, prev_hash AS prevHash, entry_hash AS entryHash, createdAt
      FROM activity_logs
      WHERE ${whereSql}
      ORDER BY createdAt DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, limit, offset],
  });

  const count = await db.execute({
    sql: `SELECT COUNT(*) as total FROM activity_logs WHERE ${whereSql}`,
    args,
  });

  const items = rows.rows.map((row) => ({
    id: row.id,
    area: row.area,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    prevHash: row.prevHash,
    entryHash: row.entryHash,
    createdAt: row.createdAt,
    payload: (() => {
      try {
        return row.payloadJson ? JSON.parse(row.payloadJson) : {};
      } catch {
        return {};
      }
    })(),
  }));

  return toPaginated(items, Number(count.rows[0]?.total || 0), page, limit);
};

const exportActivityTimelineCsv = async (userId, query = {}) => {
  const timeline = await listActivityTimeline(userId, { ...query, page: 1, limit: Math.min(1000, Number(query.limit || 500)) });
  const header = ['id', 'createdAt', 'action', 'entityType', 'entityId', 'details'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = timeline.items.map((i) => [
    i.id,
    i.createdAt,
    i.action,
    i.entityType,
    i.entityId,
    JSON.stringify(i.payload || {}),
  ].map(esc).join(','));

  return [header.map(esc).join(','), ...lines].join('\n');
};

const verifyActivityIntegrity = async (userId) => {
  const rows = await db.execute({
    sql: `
      SELECT id, area, action, entity_type AS entityType, entity_id AS entityId, payload_json AS payloadJson, prev_hash AS prevHash, entry_hash AS entryHash
      FROM activity_logs
      WHERE user_id = ?
      ORDER BY id ASC
    `,
    args: [userId],
  });

  let previousHash = '';
  const broken = [];

  for (const row of rows.rows) {
    const expected = crypto
      .createHash('sha256')
      .update(`${userId}|${row.area}|${row.action}|${row.entityType || ''}|${row.entityId || ''}|${row.payloadJson || '{}'}|${previousHash}`)
      .digest('hex');

    if ((row.prevHash || '') !== previousHash || (row.entryHash || '') !== expected) {
      broken.push({ id: row.id, reason: 'hash-mismatch' });
    }
    previousHash = row.entryHash || expected;
  }

  return {
    valid: broken.length === 0,
    count: rows.rows.length,
    broken,
    latestHash: previousHash || null,
  };
};

const getTaxSummary = async (userId, year) => {
  const safeYear = String(year || new Date().getFullYear());
  const result = await db.execute({
    sql: `
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE user_id = ?
        AND type = 'expense'
        AND strftime('%Y', date) = ?
      GROUP BY category
      ORDER BY total DESC
    `,
    args: [userId, safeYear],
  });

  const deductibleHeuristics = ['medical', 'health', 'education', 'charity', 'donation', 'tax', 'insurance', 'business'];

  const rows = result.rows.map((r) => ({
    category: r.category,
    total: Number(toNumber(r.total).toFixed(2)),
    likelyDeductible: deductibleHeuristics.some((h) => String(r.category || '').toLowerCase().includes(h)),
  }));

  return {
    year: safeYear,
    categories: rows,
    estimatedDeductibleTotal: Number(rows.filter((r) => r.likelyDeductible).reduce((a, r) => a + r.total, 0).toFixed(2)),
  };
};

const getGoalOptimizer = async (userId) => {
  const goals = await db.execute({
    sql: 'SELECT id, name, target_amount, current_amount, deadline FROM goals WHERE user_id = ? ORDER BY deadline ASC',
    args: [userId],
  });

  const recommendations = goals.rows.map((g) => {
    const remaining = Math.max(0, toNumber(g.target_amount) - toNumber(g.current_amount));
    const deadline = g.deadline ? new Date(g.deadline) : null;
    const now = new Date();
    const monthsLeft = deadline ? Math.max(1, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24 * 30))) : 12;
    return {
      id: g.id,
      name: g.name,
      remaining: Number(remaining.toFixed(2)),
      monthsLeft,
      suggestedMonthlyContribution: Number((remaining / monthsLeft).toFixed(2)),
    };
  });

  return { recommendations };
};

const getExecutiveBrief = async (userId) => {
  const [copilot, forecast, subscriptions, anomalies, netWorth] = await Promise.all([
    getCopilotSummary(userId),
    getCashflowForecast(userId, 3),
    getSubscriptionsInsights(userId),
    getAnomalies(userId),
    listNetWorthItems(userId),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    copilot,
    forecast,
    highlights: {
      potentialSubscriptions: subscriptions.candidates.slice(0, 5),
      anomalyCount: anomalies.anomalies.length,
      netWorth: netWorth.totals.netWorth,
    },
  };
};

module.exports = {
  getCopilotSummary,
  getCashflowForecast,
  getAnomalies,
  getSubscriptionsInsights,
  listNetWorthItems,
  upsertNetWorthItem,
  deleteNetWorthItem,
  evaluateScenario,
  listRules,
  createRule,
  deleteRule,
  simulateRules,
  listBills,
  upsertBill,
  deleteBill,
  getUpcomingBills,
  listHouseholds,
  createHousehold,
  joinHouseholdByInvite,
  listActivityTimeline,
  exportActivityTimelineCsv,
  verifyActivityIntegrity,
  getTaxSummary,
  getGoalOptimizer,
  getExecutiveBrief,
};
