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

const norm = (v) => String(v || '').trim().toLowerCase();

const daysDiff = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const getMonthKey = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getWeekKey = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const parseAmountFromText = (text) => {
  if (!text) return null;
  const match = String(text).match(/(?:₹|rs\.?\s*)\s*([0-9,]+(?:\.[0-9]{1,2})?)|\b([0-9,]+(?:\.[0-9]{1,2})?)\b/gi);
  if (!match || !match.length) return null;
  const cleaned = String(match[0]).replace(/[^0-9.]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const getHouseholdMembership = async (householdId, userId) => {
  const result = await db.execute({
    sql: `
      SELECT h.id AS householdId,
             h.owner_user_id AS ownerUserId,
             COALESCE(hm.role, CASE WHEN h.owner_user_id = ? THEN 'owner' ELSE NULL END) AS role
      FROM households h
      LEFT JOIN household_members hm ON hm.household_id = h.id AND hm.user_id = ?
      WHERE h.id = ?
      LIMIT 1
    `,
    args: [userId, userId, householdId],
  });
  return result.rows[0] || null;
};

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

  let daysToZero = null;
  let zeroBalanceDate = null;
  if (currentBalance > 0 && avgNet < 0) {
    daysToZero = Math.max(0, Math.floor(currentBalance / Math.abs(avgNet) * 30));
    const zeroDate = new Date();
    zeroDate.setDate(zeroDate.getDate() + daysToZero);
    zeroBalanceDate = zeroDate.toISOString().slice(0, 10);
  }

  const riskLevel = avgNet >= 0
    ? 'low'
    : (daysToZero !== null && daysToZero <= 45 ? 'high' : 'medium');

  return {
    averageMonthlyNet: Number(avgNet.toFixed(2)),
    currentBalance: Number(currentBalance.toFixed(2)),
    projection,
    daysToZero,
    zeroBalanceDate,
    riskLevel,
  };
};

const getFinancialHealthScore = async (userId) => {
  const [summary, goals, netWorth] = await Promise.all([
    db.execute({
      sql: `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
        FROM transactions
        WHERE user_id = ?
      `,
      args: [userId],
    }),
    db.execute({
      sql: 'SELECT COALESCE(SUM(target_amount - current_amount), 0) AS goalsRemaining FROM goals WHERE user_id = ?',
      args: [userId],
    }),
    db.execute({
      sql: `
        SELECT
          COALESCE(SUM(CASE WHEN kind = 'asset' THEN value ELSE 0 END), 0) AS assets,
          COALESCE(SUM(CASE WHEN kind = 'liability' THEN value ELSE 0 END), 0) AS liabilities
        FROM net_worth_items
        WHERE user_id = ?
      `,
      args: [userId],
    }),
  ]);

  const income = toNumber(summary.rows[0]?.income);
  const expense = toNumber(summary.rows[0]?.expense);
  const savingsRate = income > 0 ? Math.max(0, (income - expense) / income) : 0;
  const assets = toNumber(netWorth.rows[0]?.assets);
  const liabilities = toNumber(netWorth.rows[0]?.liabilities);
  const debtRatio = assets > 0 ? liabilities / assets : (liabilities > 0 ? 1 : 0);
  const goalsRemaining = Math.max(0, toNumber(goals.rows[0]?.goalsRemaining));

  const scoreSavings = Math.min(40, Math.round(savingsRate * 100));
  const scoreDebt = Math.max(0, Math.min(35, Math.round((1 - debtRatio) * 35)));
  const scoreNetWorth = Math.min(15, assets > liabilities ? 15 : Math.round((assets / Math.max(liabilities, 1)) * 15));
  const scoreGoals = Math.min(10, goalsRemaining === 0 ? 10 : Math.max(0, 10 - Math.round(Math.log10(goalsRemaining + 1) * 4)));

  const score = Math.max(0, Math.min(100, scoreSavings + scoreDebt + scoreNetWorth + scoreGoals));

  return {
    score,
    band: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'needs-attention',
    metrics: {
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      savingsRate: Number((savingsRate * 100).toFixed(2)),
      debtRatio: Number((debtRatio * 100).toFixed(2)),
      assets: Number(assets.toFixed(2)),
      liabilities: Number(liabilities.toFixed(2)),
      goalsRemaining: Number(goalsRemaining.toFixed(2)),
    },
    breakdown: {
      savingsDiscipline: scoreSavings,
      debtManagement: scoreDebt,
      netWorthStrength: scoreNetWorth,
      goalProgress: scoreGoals,
    },
  };
};

const getAutoCategorySuggestions = async (userId, title, amount = 0) => {
  const cleanTitle = norm(title);
  if (!cleanTitle) return { suggestions: [] };

  const [exactMatches, containsMatches, feedback, rulesResult] = await Promise.all([
    db.execute({
      sql: `
        SELECT category, COUNT(*) AS uses
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND LOWER(TRIM(title)) = ?
        GROUP BY category
        ORDER BY uses DESC
        LIMIT 5
      `,
      args: [userId, cleanTitle],
    }),
    db.execute({
      sql: `
        SELECT category, COUNT(*) AS uses
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND LOWER(title) LIKE ?
        GROUP BY category
        ORDER BY uses DESC
        LIMIT 5
      `,
      args: [userId, `%${cleanTitle.split(' ')[0]}%`],
    }),
    db.execute({
      sql: `
        SELECT selected_category AS category, COUNT(*) AS uses
        FROM category_feedback
        WHERE user_id = ? AND LOWER(input_title) = ?
        GROUP BY selected_category
        ORDER BY uses DESC
        LIMIT 5
      `,
      args: [userId, cleanTitle],
    }),
    listRules(userId, { page: 1, limit: 100 }),
  ]);

  const scoreMap = new Map();
  const addScore = (category, points, source) => {
    if (!category) return;
    const curr = scoreMap.get(category) || { category, score: 0, reasons: [] };
    curr.score += points;
    curr.reasons.push(source);
    scoreMap.set(category, curr);
  };

  exactMatches.rows.forEach((r) => addScore(r.category, 60 + Number(r.uses || 0) * 3, 'exact-history'));
  containsMatches.rows.forEach((r) => addScore(r.category, 30 + Number(r.uses || 0) * 2, 'similar-history'));
  feedback.rows.forEach((r) => addScore(r.category, 80 + Number(r.uses || 0) * 4, 'user-feedback'));

  const sample = { title, amount: Number(amount || 0), type: 'expense', category: 'Other' };
  const sim = await simulateRules(userId, sample);
  if (sim?.transformed?.category && sim.transformed.category !== 'Other') {
    addScore(sim.transformed.category, 70, 'rule-engine');
  }

  const suggestions = [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => ({
      category: s.category,
      confidence: Math.min(0.99, Number((s.score / 160).toFixed(2))),
      reasons: s.reasons,
    }));

  return {
    title,
    amount: Number(amount || 0),
    suggestions,
    suggested: suggestions[0]?.category || null,
  };
};

const submitAutoCategoryFeedback = async (userId, payload = {}) => {
  await db.execute({
    sql: `
      INSERT INTO category_feedback (user_id, input_title, suggested_category, selected_category, confidence, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      userId,
      String(payload.inputTitle || ''),
      payload.suggestedCategory || null,
      String(payload.selectedCategory || ''),
      Number(payload.confidence || 0),
      payload.source || 'manual-feedback',
    ],
  });

  await logActivity(userId, 'next-level', 'create', 'autocategory-feedback', null, {
    inputTitle: payload.inputTitle,
    selectedCategory: payload.selectedCategory,
  });

  return { success: true };
};

const reconcileStatementRows = async (userId, payload = {}) => {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const sourceLabel = String(payload.sourceLabel || 'manual-upload').slice(0, 100);
  if (rows.length === 0) {
    return { total: 0, duplicates: [], newRows: [], summary: { duplicateRows: 0, newRows: 0 } };
  }

  const existing = await db.execute({
    sql: 'SELECT id, title, amount, type, category, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 5000',
    args: [userId],
  });

  const duplicates = [];
  const newRows = [];

  for (const row of rows) {
    const rTitle = norm(row.title);
    const rAmount = Number(row.amount || 0);
    const rType = String(row.type || 'expense');
    const rDate = row.date ? new Date(row.date).toISOString() : null;

    const match = existing.rows.find((tx) => {
      const titleClose = norm(tx.title) === rTitle || norm(tx.title).includes(rTitle) || rTitle.includes(norm(tx.title));
      const amountClose = Math.abs(Number(tx.amount || 0) - rAmount) < 0.01;
      const typeClose = String(tx.type || '') === rType;
      const dateClose = rDate ? daysDiff(tx.date, rDate) <= 2 : true;
      return titleClose && amountClose && typeClose && dateClose;
    });

    if (match) {
      duplicates.push({ input: row, matchedTransaction: match });
    } else {
      newRows.push(row);
    }
  }

  await db.execute({
    sql: `
      INSERT INTO statement_reconciliations (user_id, source_label, total_rows, duplicate_rows, new_rows, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [userId, sourceLabel, rows.length, duplicates.length, newRows.length, JSON.stringify({ rows, duplicates: duplicates.length, newRows: newRows.length })],
  });

  await logActivity(userId, 'next-level', 'create', 'statement-reconcile', null, {
    sourceLabel,
    totalRows: rows.length,
    duplicates: duplicates.length,
    newRows: newRows.length,
  });

  return {
    total: rows.length,
    duplicates,
    newRows,
    summary: {
      duplicateRows: duplicates.length,
      newRows: newRows.length,
      duplicateRate: Number(((duplicates.length / rows.length) * 100).toFixed(2)),
    },
  };
};

const getAnomalies = async (userId) => {
  const [rows, feedback] = await Promise.all([
    db.execute({
      sql: `
        SELECT id, title, amount, category, date
        FROM transactions
        WHERE user_id = ? AND type = 'expense'
        ORDER BY date DESC
        LIMIT 400
      `,
      args: [userId],
    }),
    db.execute({
      sql: `
        SELECT transaction_id AS transactionId, title_pattern AS titlePattern, amount
        FROM anomaly_feedback
        WHERE user_id = ? AND action = 'expected'
        ORDER BY createdAt DESC
        LIMIT 300
      `,
      args: [userId],
    }),
  ]);

  const expectedTransactionIds = new Set(
    feedback.rows
      .map((f) => Number(f.transactionId || 0))
      .filter((id) => id > 0)
  );
  const expectedTitlePatterns = feedback.rows
    .map((f) => norm(f.titlePattern))
    .filter(Boolean);

  const values = rows.rows.map((r) => toNumber(r.amount));
  if (values.length < 5) {
    return { threshold: null, anomalies: [] };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  const threshold = mean + stdev * 2;

  const anomalies = rows.rows
    .filter((r) => {
      if (toNumber(r.amount) < threshold) return false;
      if (expectedTransactionIds.has(Number(r.id))) return false;
      const title = norm(r.title);
      if (expectedTitlePatterns.some((p) => p && (title.includes(p) || p.includes(title)))) return false;
      return true;
    })
    .slice(0, 15);

  return {
    threshold: Number(threshold.toFixed(2)),
    totalScanned: rows.rows.length,
    ignoredAsExpected: expectedTransactionIds.size,
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
      estimatedAnnualImpact: Number((toNumber(r.avg_amount) * 12).toFixed(2)),
    }));

  const [recent90d, recent30d] = await Promise.all([
    db.execute({
      sql: `
        SELECT LOWER(TRIM(title)) AS normalized_title, COUNT(*) AS cnt
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND date >= datetime('now', '-90 day')
        GROUP BY LOWER(TRIM(title))
      `,
      args: [userId],
    }),
    db.execute({
      sql: `
        SELECT LOWER(TRIM(title)) AS normalized_title, COUNT(*) AS cnt
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND date >= datetime('now', '-30 day')
        GROUP BY LOWER(TRIM(title))
      `,
      args: [userId],
    }),
  ]);

  const count90 = new Map(recent90d.rows.map((r) => [String(r.normalized_title || ''), Number(r.cnt || 0)]));
  const count30 = new Map(recent30d.rows.map((r) => [String(r.normalized_title || ''), Number(r.cnt || 0)]));

  const candidatesWithStatus = candidates.map((c) => {
    const key = norm(c.title);
    const last90 = count90.get(key) || 0;
    const last30 = count30.get(key) || 0;
    const likelyInactive = last90 >= 2 && last30 === 0;
    return {
      ...c,
      status: likelyInactive ? 'unused-candidate' : 'active',
      remindAction: likelyInactive ? 'review-or-cancel' : 'keep-tracking',
    };
  });

  return {
    candidates: candidatesWithStatus,
    summary: {
      count: candidatesWithStatus.length,
      activeCount: candidatesWithStatus.filter((c) => c.status === 'active').length,
      unusedCandidateCount: candidatesWithStatus.filter((c) => c.status === 'unused-candidate').length,
      estimatedMonthlyImpact: Number(candidatesWithStatus.reduce((a, c) => a + Number(c.estimatedMonthlyImpact || 0), 0).toFixed(2)),
      estimatedAnnualImpact: Number(candidatesWithStatus.reduce((a, c) => a + Number(c.estimatedAnnualImpact || 0), 0).toFixed(2)),
    },
  };
};

const submitAnomalyFeedback = async (userId, payload = {}) => {
  const transactionId = Number(payload.transactionId || 0) || null;
  const titlePattern = payload.titlePattern ? String(payload.titlePattern).slice(0, 120) : null;
  const amount = payload.amount !== undefined ? Number(payload.amount || 0) : null;
  const action = String(payload.action || 'expected');

  await db.execute({
    sql: `
      INSERT INTO anomaly_feedback (user_id, transaction_id, title_pattern, amount, action)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [userId, transactionId, titlePattern, amount, action],
  });

  await logActivity(userId, 'next-level', 'create', 'anomaly-feedback', transactionId, {
    action,
    titlePattern,
    amount,
  });

  return { success: true };
};

const parseReceiptOcr = async (userId, payload = {}) => {
  const rawText = String(payload.rawText || payload.text || '').trim();
  if (!rawText) {
    return {
      merchant: null,
      amount: null,
      date: null,
      taxAmount: null,
      category: 'Other',
      confidence: 0,
      rawText: '',
    };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const merchant = lines[0]?.slice(0, 120) || null;
  const amount = parseAmountFromText(rawText);
  const dateMatch = rawText.match(/\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/);
  const date = dateMatch ? new Date(dateMatch[0]).toISOString().slice(0, 10) : null;

  const taxLine = lines.find((l) => /gst|tax|vat/i.test(l)) || '';
  const taxAmount = parseAmountFromText(taxLine);

  const categoryGuess = await getAutoCategorySuggestions(userId, merchant || rawText.slice(0, 80), amount || 0);
  const category = categoryGuess.suggested || 'Other';
  const confidence = Number(([
    merchant ? 0.25 : 0,
    amount ? 0.35 : 0,
    date ? 0.15 : 0,
    taxAmount ? 0.1 : 0,
    category !== 'Other' ? 0.15 : 0,
  ].reduce((a, b) => a + b, 0)).toFixed(2));

  await logActivity(userId, 'next-level', 'create', 'receipt-ocr', null, {
    merchant,
    amount,
    date,
    category,
    confidence,
  });

  return {
    merchant,
    amount,
    date,
    taxAmount,
    category,
    confidence,
    rawText,
  };
};

const simulateCashflowWhatIf = async (userId, payload = {}) => {
  const months = Math.max(1, Math.min(36, Number(payload.months || 6)));
  const sipIncrease = Number(payload.sipIncrease || 0);
  const rentIncreasePct = Number(payload.rentIncreasePct || 0);
  const oneTimeExpense = Number(payload.oneTimeExpense || 0);

  const forecast = await getCashflowForecast(userId, months);
  const currentMonthlyNet = Number(forecast.averageMonthlyNet || 0);

  const rentSpend = await db.execute({
    sql: `
      SELECT COALESCE(AVG(amount), 0) AS avgRent
      FROM transactions
      WHERE user_id = ? AND type = 'expense' AND LOWER(category) LIKE '%rent%'
    `,
    args: [userId],
  });
  const avgRent = Number(rentSpend.rows[0]?.avgRent || 0);
  const rentImpact = avgRent * (rentIncreasePct / 100);

  const adjustedMonthlyNet = currentMonthlyNet - sipIncrease - rentImpact;
  const projectedEndingBalance = Number((Number(forecast.currentBalance || 0) + (adjustedMonthlyNet * months) - oneTimeExpense).toFixed(2));

  return {
    months,
    baselineMonthlyNet: Number(currentMonthlyNet.toFixed(2)),
    adjustedMonthlyNet: Number(adjustedMonthlyNet.toFixed(2)),
    sipIncrease: Number(sipIncrease.toFixed(2)),
    rentIncreasePct: Number(rentIncreasePct.toFixed(2)),
    rentImpact: Number(rentImpact.toFixed(2)),
    oneTimeExpense: Number(oneTimeExpense.toFixed(2)),
    projectedEndingBalance,
    deltaVsBaseline: Number(((adjustedMonthlyNet - currentMonthlyNet) * months - oneTimeExpense).toFixed(2)),
    riskLevel: adjustedMonthlyNet < 0 ? 'high' : adjustedMonthlyNet < currentMonthlyNet * 0.5 ? 'medium' : 'low',
  };
};

const getDebtPayoffPlan = async (userId, payload = {}) => {
  const strategy = String(payload.strategy || 'snowball');
  const extraPayment = Math.max(0, Number(payload.extraPayment || 0));
  const debts = Array.isArray(payload.debts) ? payload.debts : [];

  const normalized = debts
    .map((d) => ({
      name: String(d.name || 'Debt').slice(0, 100),
      balance: Math.max(0, Number(d.balance || 0)),
      apr: Math.max(0, Number(d.apr || 0)),
      minPayment: Math.max(0, Number(d.minPayment || 0)),
    }))
    .filter((d) => d.balance > 0);

  const ordered = [...normalized].sort((a, b) => {
    if (strategy === 'avalanche') return b.apr - a.apr;
    return a.balance - b.balance;
  });

  const totalMin = ordered.reduce((a, d) => a + d.minPayment, 0);
  const totalBalance = ordered.reduce((a, d) => a + d.balance, 0);
  const weightedApr = totalBalance > 0
    ? ordered.reduce((a, d) => a + (d.balance * d.apr), 0) / totalBalance
    : 0;

  const monthlyRate = weightedApr / 1200;
  const monthlyPayment = totalMin + extraPayment;
  const estimatedMonths = monthlyPayment <= 0
    ? null
    : Math.max(1, Math.ceil(Math.log(monthlyPayment / Math.max(1, monthlyPayment - (totalBalance * monthlyRate))) / Math.log(1 + monthlyRate)));

  const estimatedInterest = estimatedMonths
    ? Number(((monthlyPayment * estimatedMonths) - totalBalance).toFixed(2))
    : null;

  await logActivity(userId, 'next-level', 'create', 'debt-plan', null, {
    strategy,
    debtCount: ordered.length,
    totalBalance,
  });

  return {
    strategy,
    debts: ordered,
    totals: {
      totalBalance: Number(totalBalance.toFixed(2)),
      totalMinPayment: Number(totalMin.toFixed(2)),
      extraPayment: Number(extraPayment.toFixed(2)),
      weightedApr: Number(weightedApr.toFixed(2)),
      estimatedMonths,
      estimatedInterest,
    },
  };
};

const getFinancialCalendar = async (userId, days = 45) => {
  const safeDays = Math.max(1, Math.min(120, Number(days || 45)));
  const monthKey = getMonthKey();
  const [upcomingBills, recurring, goals, approvals] = await Promise.all([
    getUpcomingBills(userId, { dueWithinDays: safeDays, page: 1, limit: 100 }),
    db.execute({
      sql: `
        SELECT id, title, amount, frequency, next_date AS nextDate, category
        FROM recurring_transactions
        WHERE user_id = ? AND paused = 0 AND datetime(next_date) <= datetime('now', ?)
        ORDER BY next_date ASC
        LIMIT 100
      `,
      args: [userId, `+${safeDays} day`],
    }),
    db.execute({
      sql: `
        SELECT id, name, target_amount AS targetAmount, current_amount AS currentAmount, deadline
        FROM goals
        WHERE user_id = ? AND deadline IS NOT NULL AND datetime(deadline) <= datetime('now', ?)
        ORDER BY deadline ASC
        LIMIT 100
      `,
      args: [userId, `+${safeDays} day`],
    }),
    db.execute({
      sql: `
        SELECT a.id, a.household_id AS householdId, a.title, a.amount, a.createdAt
        FROM household_approvals a
        WHERE a.requester_user_id = ? AND a.status = 'pending'
        ORDER BY a.createdAt ASC
        LIMIT 100
      `,
      args: [userId],
    }),
  ]);

  const events = [
    ...upcomingBills.map((b) => ({
      type: 'bill',
      date: b.nextDueDate,
      title: b.name,
      amount: Number(b.amount || 0),
      meta: { dueDay: b.due_day, monthKey },
    })),
    ...recurring.rows.map((r) => ({
      type: 'recurring',
      date: r.nextDate,
      title: r.title,
      amount: Number(r.amount || 0),
      meta: { frequency: r.frequency, category: r.category },
    })),
    ...goals.rows.map((g) => ({
      type: 'goal-deadline',
      date: g.deadline,
      title: g.name,
      amount: Number(Math.max(0, Number(g.targetAmount || 0) - Number(g.currentAmount || 0)).toFixed(2)),
      meta: { remaining: Math.max(0, Number(g.targetAmount || 0) - Number(g.currentAmount || 0)) },
    })),
    ...approvals.rows.map((a) => ({
      type: 'approval-pending',
      date: a.createdAt,
      title: a.title,
      amount: Number(a.amount || 0),
      meta: { householdId: a.householdId },
    })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    horizonDays: safeDays,
    monthKey,
    events,
  };
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

  const aggregates = await db.execute({
    sql: `
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'asset' THEN value ELSE 0 END), 0) AS assets,
        COALESCE(SUM(CASE WHEN kind = 'liability' THEN value ELSE 0 END), 0) AS liabilities
      FROM net_worth_items
      WHERE ${whereSql}
    `,
    args,
  });
  const assets = toNumber(aggregates.rows[0]?.assets);
  const liabilities = toNumber(aggregates.rows[0]?.liabilities);

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
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueWithinDays = Math.max(1, Number(query.dueWithinDays || 31));

  const buildNextDueDate = (dueDay) => {
    const year = startToday.getFullYear();
    const month = startToday.getMonth();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const currentMonthDue = new Date(year, month, Math.min(dueDay, daysInCurrentMonth));
    if (currentMonthDue >= startToday) {
      return currentMonthDue;
    }

    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const normalizedNextMonth = nextMonth % 12;
    const daysInNextMonth = new Date(nextYear, normalizedNextMonth + 1, 0).getDate();
    return new Date(nextYear, normalizedNextMonth, Math.min(dueDay, daysInNextMonth));
  };

  const upcoming = bills
    .map((b) => {
      const dueDay = Number(b.due_day);
      const nextDue = buildNextDueDate(dueDay);
      const daysUntil = Math.ceil((nextDue - startToday) / (1000 * 60 * 60 * 24));
      return {
        ...b,
        daysUntil,
        nextDueDate: nextDue.toISOString().slice(0, 10),
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
      SELECT
        h.*,
        CASE
          WHEN h.owner_user_id = ? THEN 'owner'
          ELSE COALESCE((SELECT hm.role FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id = ? LIMIT 1), 'viewer')
        END AS yourRole,
        (SELECT COUNT(*) FROM household_members hm2 WHERE hm2.household_id = h.id) AS memberCount
      FROM households h
      WHERE (h.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.household_id = h.id AND hm.user_id = ?
      ))
        AND (? = '' OR LOWER(h.name) LIKE ?)
      ORDER BY h.id DESC
      LIMIT ? OFFSET ?
    `,
    args: [userId, userId, userId, userId, search, `%${search}%`, limit, offset],
  });
  const count = await db.execute({
    sql: `
      SELECT COUNT(*) as total
      FROM households h
      WHERE (h.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.household_id = h.id AND hm.user_id = ?
      ))
        AND (? = '' OR LOWER(h.name) LIKE ?)
    `,
    args: [userId, userId, search, `%${search}%`],
  });

  return toPaginated(result.rows, Number(count.rows[0]?.total || 0), page, limit);
};

const getHouseholdById = async (userId, householdId) => {
  const result = await db.execute({
    sql: `
      SELECT
        h.*,
        CASE
          WHEN h.owner_user_id = ? THEN 'owner'
          ELSE COALESCE((SELECT hm.role FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id = ? LIMIT 1), 'viewer')
        END AS yourRole,
        (SELECT COUNT(*) FROM household_members hm2 WHERE hm2.household_id = h.id) AS memberCount
      FROM households h
      WHERE h.id = ?
        AND (h.owner_user_id = ? OR EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.household_id = h.id AND hm.user_id = ?
        ))
      LIMIT 1
    `,
    args: [userId, userId, householdId, userId, userId],
  });

  return result.rows[0] || null;
};

const listHouseholdMembers = async (userId, householdId) => {
  const household = await getHouseholdById(userId, householdId);
  if (!household) {
    throw new Error('Household not found or inaccessible.');
  }

  const members = await db.execute({
    sql: `
      SELECT
        hm.id,
        hm.household_id AS householdId,
        hm.user_id AS userId,
        hm.role,
        hm.createdAt,
        u.username,
        CASE WHEN h.owner_user_id = hm.user_id THEN 1 ELSE 0 END AS isOwner
      FROM household_members hm
      INNER JOIN users u ON u.id = hm.user_id
      INNER JOIN households h ON h.id = hm.household_id
      WHERE hm.household_id = ?
      ORDER BY isOwner DESC, hm.createdAt ASC
    `,
    args: [householdId],
  });

  return {
    household: {
      id: household.id,
      name: household.name,
      invite_code: household.invite_code,
      yourRole: household.yourRole,
      memberCount: household.memberCount,
    },
    members: members.rows,
  };
};

const updateHouseholdMemberRole = async (userId, householdId, memberUserId, role) => {
  const ownerCheck = await db.execute({
    sql: 'SELECT owner_user_id AS ownerUserId FROM households WHERE id = ? LIMIT 1',
    args: [householdId],
  });
  const household = ownerCheck.rows[0];
  if (!household) {
    throw new Error('Household not found.');
  }

  if (Number(household.ownerUserId) !== Number(userId)) {
    throw new Error('Only household owner can manage member roles.');
  }

  if (Number(memberUserId) === Number(household.ownerUserId)) {
    throw new Error('Owner role cannot be changed.');
  }

  const update = await db.execute({
    sql: 'UPDATE household_members SET role = ? WHERE household_id = ? AND user_id = ?',
    args: [role, householdId, memberUserId],
  });

  if (Number(update.rowsAffected || 0) === 0) {
    throw new Error('Household member not found.');
  }

  const updated = await db.execute({
    sql: `
      SELECT
        hm.id,
        hm.household_id AS householdId,
        hm.user_id AS userId,
        hm.role,
        hm.createdAt,
        u.username
      FROM household_members hm
      INNER JOIN users u ON u.id = hm.user_id
      WHERE hm.household_id = ? AND hm.user_id = ?
      LIMIT 1
    `,
    args: [householdId, memberUserId],
  });

  await logActivity(userId, 'next-level', 'update', 'household', householdId, {
    memberUserId,
    newRole: role,
  });

  return updated.rows[0];
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

const setHouseholdSpendingLimit = async (userId, householdId, memberUserId, monthlyLimit) => {
  const membership = await getHouseholdMembership(householdId, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');
  if (membership.role !== 'owner') throw new Error('Only household owner can set spending limits.');

  await db.execute({
    sql: `
      INSERT INTO household_spending_limits (household_id, user_id, monthly_limit, created_by, updatedAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(household_id, user_id)
      DO UPDATE SET monthly_limit = excluded.monthly_limit, created_by = excluded.created_by, updatedAt = CURRENT_TIMESTAMP
    `,
    args: [householdId, memberUserId, Number(monthlyLimit || 0), userId],
  });

  await logActivity(userId, 'next-level', 'update', 'household-limit', householdId, {
    memberUserId,
    monthlyLimit: Number(monthlyLimit || 0),
  });

  return { success: true };
};

const listHouseholdSpendingLimits = async (userId, householdId) => {
  const membership = await getHouseholdMembership(householdId, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');

  const rows = await db.execute({
    sql: `
      SELECT l.id, l.household_id AS householdId, l.user_id AS userId, l.monthly_limit AS monthlyLimit, l.updatedAt,
             u.username
      FROM household_spending_limits l
      INNER JOIN users u ON u.id = l.user_id
      WHERE l.household_id = ?
      ORDER BY u.username ASC
    `,
    args: [householdId],
  });

  return { items: rows.rows };
};

const createHouseholdApprovalRequest = async (userId, payload = {}) => {
  const householdId = Number(payload.householdId || 0);
  const membership = await getHouseholdMembership(householdId, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');

  const insert = await db.execute({
    sql: `
      INSERT INTO household_approvals (household_id, requester_user_id, amount, title, category, note, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `,
    args: [
      householdId,
      userId,
      Number(payload.amount || 0),
      String(payload.title || '').slice(0, 200),
      payload.category ? String(payload.category).slice(0, 50) : null,
      payload.note ? String(payload.note).slice(0, 300) : null,
    ],
  });

  const id = Number(insert.lastInsertRowid);
  const created = await db.execute({
    sql: 'SELECT * FROM household_approvals WHERE id = ?',
    args: [id],
  });

  await logActivity(userId, 'next-level', 'create', 'household-approval', id, {
    householdId,
    amount: Number(payload.amount || 0),
    title: payload.title,
  });

  return created.rows[0];
};

const listHouseholdApprovals = async (userId, householdId, status = '') => {
  const membership = await getHouseholdMembership(householdId, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');

  const args = [householdId];
  let where = 'a.household_id = ?';
  if (status) {
    where += ' AND a.status = ?';
    args.push(status);
  }

  const rows = await db.execute({
    sql: `
      SELECT a.id, a.household_id AS householdId, a.requester_user_id AS requesterUserId,
             a.amount, a.title, a.category, a.note, a.status, a.decided_by AS decidedBy,
             a.decided_note AS decidedNote, a.decided_at AS decidedAt, a.createdAt,
             ru.username AS requesterUsername,
             du.username AS decidedByUsername
      FROM household_approvals a
      INNER JOIN users ru ON ru.id = a.requester_user_id
      LEFT JOIN users du ON du.id = a.decided_by
      WHERE ${where}
      ORDER BY a.createdAt DESC, a.id DESC
      LIMIT 100
    `,
    args,
  });

  return { items: rows.rows, role: membership.role };
};

const decideHouseholdApproval = async (userId, approvalId, decision, note = '') => {
  const approval = await db.execute({
    sql: 'SELECT * FROM household_approvals WHERE id = ? LIMIT 1',
    args: [approvalId],
  });
  const row = approval.rows[0];
  if (!row) throw new Error('Approval request not found.');
  if (row.status !== 'pending') throw new Error('Approval request already decided.');

  const membership = await getHouseholdMembership(row.household_id, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');
  if (!['owner', 'editor'].includes(membership.role)) {
    throw new Error('Only household owner/editor can decide approvals.');
  }

  await db.execute({
    sql: `
      UPDATE household_approvals
      SET status = ?, decided_by = ?, decided_note = ?, decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    args: [decision, userId, note || null, approvalId],
  });

  const updated = await db.execute({
    sql: 'SELECT * FROM household_approvals WHERE id = ? LIMIT 1',
    args: [approvalId],
  });

  await logActivity(userId, 'next-level', 'update', 'household-approval', approvalId, {
    decision,
    note,
  });

  return updated.rows[0];
};

const listApprovalComments = async (userId, approvalId) => {
  const approval = await db.execute({
    sql: 'SELECT id, household_id AS householdId FROM household_approvals WHERE id = ? LIMIT 1',
    args: [approvalId],
  });
  const row = approval.rows[0];
  if (!row) throw new Error('Approval request not found.');

  const membership = await getHouseholdMembership(row.householdId, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');

  const comments = await db.execute({
    sql: `
      SELECT c.id, c.comment, c.createdAt, c.user_id AS userId, u.username
      FROM household_approval_comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.approval_id = ?
      ORDER BY c.createdAt ASC, c.id ASC
    `,
    args: [approvalId],
  });

  return { items: comments.rows };
};

const addApprovalComment = async (userId, approvalId, comment) => {
  const approval = await db.execute({
    sql: 'SELECT id, household_id AS householdId FROM household_approvals WHERE id = ? LIMIT 1',
    args: [approvalId],
  });
  const row = approval.rows[0];
  if (!row) throw new Error('Approval request not found.');

  const membership = await getHouseholdMembership(row.householdId, userId);
  if (!membership || !membership.role) throw new Error('Household not found or inaccessible.');

  const insert = await db.execute({
    sql: `
      INSERT INTO household_approval_comments (approval_id, household_id, user_id, comment)
      VALUES (?, ?, ?, ?)
    `,
    args: [approvalId, row.householdId, userId, String(comment || '').slice(0, 500)],
  });

  await logActivity(userId, 'next-level', 'create', 'household-approval-comment', Number(insert.lastInsertRowid), {
    approvalId,
  });

  const created = await db.execute({
    sql: `
      SELECT c.id, c.comment, c.createdAt, c.user_id AS userId, u.username
      FROM household_approval_comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      LIMIT 1
    `,
    args: [Number(insert.lastInsertRowid)],
  });

  return created.rows[0] || null;
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
    where.push("datetime(createdAt) < datetime(?, '+1 day')");
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
  const section80CHeuristics = ['ppf', 'elss', 'life insurance', 'epf', 'nsc', 'tuition'];
  const hraHeuristics = ['rent', 'house rent', 'hra'];

  const rows = result.rows.map((r) => ({
    category: r.category,
    total: Number(toNumber(r.total).toFixed(2)),
    likelyDeductible: deductibleHeuristics.some((h) => String(r.category || '').toLowerCase().includes(h)),
  }));

  const estimatedDeductibleTotal = Number(rows.filter((r) => r.likelyDeductible).reduce((a, r) => a + r.total, 0).toFixed(2));
  const section80CEstimate = Number(rows.filter((r) => section80CHeuristics.some((h) => String(r.category || '').toLowerCase().includes(h))).reduce((a, r) => a + r.total, 0).toFixed(2));
  const hraEstimate = Number(rows.filter((r) => hraHeuristics.some((h) => String(r.category || '').toLowerCase().includes(h))).reduce((a, r) => a + r.total, 0).toFixed(2));

  return {
    year: safeYear,
    categories: rows,
    estimatedDeductibleTotal,
    indiaTrackers: {
      section80C: {
        estimate: section80CEstimate,
        cap: 150000,
        remainingCap: Number(Math.max(0, 150000 - section80CEstimate).toFixed(2)),
      },
      hra: {
        rentTaggedSpend: hraEstimate,
      },
    },
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

const listGoalAutopilotRules = async (userId) => {
  const rows = await db.execute({
    sql: `
      SELECT r.*, g.name AS goalName
      FROM goal_autopilot_rules r
      LEFT JOIN goals g ON g.id = r.goal_id
      WHERE r.user_id = ?
      ORDER BY r.updatedAt DESC, r.id DESC
    `,
    args: [userId],
  });
  return { items: rows.rows };
};

const upsertGoalAutopilotRule = async (userId, payload = {}) => {
  const id = Number(payload.id || 0);
  const args = [
    userId,
    payload.goalId ? Number(payload.goalId) : null,
    String(payload.name || 'Auto Rule').slice(0, 100),
    String(payload.ruleType || 'payday_percent'),
    Number(payload.ruleValue || 0),
    payload.enabled === false ? 0 : 1,
  ];

  if (id > 0) {
    await db.execute({
      sql: `
        UPDATE goal_autopilot_rules
        SET goal_id = ?, name = ?, rule_type = ?, rule_value = ?, enabled = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
      args: [args[1], args[2], args[3], args[4], args[5], id, userId],
    });
    const updated = await db.execute({ sql: 'SELECT * FROM goal_autopilot_rules WHERE id = ? AND user_id = ?', args: [id, userId] });
    await logActivity(userId, 'next-level', 'update', 'goal-autopilot-rule', id, { ruleType: args[3] });
    return updated.rows[0];
  }

  const created = await db.execute({
    sql: `
      INSERT INTO goal_autopilot_rules (user_id, goal_id, name, rule_type, rule_value, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args,
  });

  await logActivity(userId, 'next-level', 'create', 'goal-autopilot-rule', Number(created.lastInsertRowid), { ruleType: args[3] });
  const inserted = await db.execute({ sql: 'SELECT * FROM goal_autopilot_rules WHERE id = ?', args: [Number(created.lastInsertRowid)] });
  return inserted.rows[0];
};

const deleteGoalAutopilotRule = async (userId, id) => {
  await db.execute({ sql: 'DELETE FROM goal_autopilot_rules WHERE id = ? AND user_id = ?', args: [id, userId] });
  await logActivity(userId, 'next-level', 'delete', 'goal-autopilot-rule', id, {});
  return { id };
};

const projectGoalAutopilot = async (userId) => {
  const [rules, goals, income] = await Promise.all([
    listGoalAutopilotRules(userId),
    db.execute({ sql: 'SELECT id, name, target_amount AS targetAmount, current_amount AS currentAmount, deadline FROM goals WHERE user_id = ?', args: [userId] }),
    db.execute({
      sql: `
        SELECT COALESCE(AVG(amount), 0) AS avgIncome
        FROM transactions
        WHERE user_id = ? AND type = 'income' AND date >= datetime('now', '-90 day')
      `,
      args: [userId],
    }),
  ]);

  const avgIncome = Number(income.rows[0]?.avgIncome || 0);
  const enabledRules = (rules.items || []).filter((r) => Number(r.enabled) === 1);

  const estimatedMonthlyContribution = enabledRules.reduce((sum, r) => {
    if (r.rule_type === 'payday_percent') return sum + (avgIncome * (Number(r.rule_value || 0) / 100));
    if (r.rule_type === 'roundup') return sum + Number(r.rule_value || 0) * 20;
    if (r.rule_type === 'threshold_sweep') return sum + Number(r.rule_value || 0);
    return sum;
  }, 0);

  const projections = goals.rows.map((g) => {
    const remaining = Math.max(0, Number(g.targetAmount || 0) - Number(g.currentAmount || 0));
    const monthsToGoal = estimatedMonthlyContribution > 0 ? Math.ceil(remaining / estimatedMonthlyContribution) : null;
    return {
      goalId: g.id,
      goalName: g.name,
      remaining: Number(remaining.toFixed(2)),
      estimatedMonthlyContribution: Number(estimatedMonthlyContribution.toFixed(2)),
      estimatedMonthsToGoal: monthsToGoal,
    };
  });

  return {
    avgIncome: Number(avgIncome.toFixed(2)),
    enabledRuleCount: enabledRules.length,
    estimatedMonthlyContribution: Number(estimatedMonthlyContribution.toFixed(2)),
    projections,
  };
};

const getExecutiveBrief = async (userId) => {
  const [copilot, forecast, subscriptions, anomalies, netWorth, health] = await Promise.all([
    getCopilotSummary(userId),
    getCashflowForecast(userId, 3),
    getSubscriptionsInsights(userId),
    getAnomalies(userId),
    listNetWorthItems(userId),
    getFinancialHealthScore(userId),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    copilot,
    forecast,
    highlights: {
      potentialSubscriptions: subscriptions.candidates.slice(0, 5),
      anomalyCount: anomalies.anomalies.length,
      netWorth: netWorth.totals.netWorth,
      healthScore: health.score,
    },
  };
};

const getWeeklyCfoBrief = async (userId) => {
  const weekKey = getWeekKey();
  const existing = await db.execute({
    sql: 'SELECT brief_json AS briefJson FROM weekly_cfo_briefs WHERE user_id = ? AND week_key = ? LIMIT 1',
    args: [userId, weekKey],
  });

  if (existing.rows[0]?.briefJson) {
    try {
      return JSON.parse(existing.rows[0].briefJson);
    } catch {
      // continue to recompute
    }
  }

  const [copilot, forecast, subscriptions, anomalies, health] = await Promise.all([
    getCopilotSummary(userId),
    getCashflowForecast(userId, 1),
    getSubscriptionsInsights(userId),
    getAnomalies(userId),
    getFinancialHealthScore(userId),
  ]);

  const actionable = [];
  if (forecast.averageMonthlyNet < 0) actionable.push('Reduce discretionary spend by 10% this week to move net cashflow positive.');
  if ((subscriptions.summary?.unusedCandidateCount || 0) > 0) actionable.push(`Review ${subscriptions.summary.unusedCandidateCount} unused subscription candidate(s) and cancel non-essential ones.`);
  if ((anomalies.anomalies || []).length > 0) actionable.push('Confirm large flagged transactions and mark expected ones to reduce false alerts.');
  if (health.score < 60) actionable.push('Prioritize debt reduction and automate a small weekly transfer toward emergency savings.');
  if (actionable.length === 0) actionable.push('Maintain current course and increase goal contribution by 5% this week.');

  const brief = {
    weekKey,
    generatedAt: new Date().toISOString(),
    snapshot: {
      net: Number(copilot?.stats?.net || 0),
      savingsRate: Number(health?.metrics?.savingsRate || 0),
      healthScore: Number(health?.score || 0),
      anomalyCount: (anomalies.anomalies || []).length,
      subscriptionLeak: Number(subscriptions.summary?.estimatedMonthlyImpact || 0),
    },
    recommendations: actionable.slice(0, 3),
  };

  await db.execute({
    sql: `
      INSERT INTO weekly_cfo_briefs (user_id, week_key, brief_json)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, week_key)
      DO UPDATE SET brief_json = excluded.brief_json
    `,
    args: [userId, weekKey, JSON.stringify(brief)],
  });

  await logActivity(userId, 'next-level', 'create', 'weekly-cfo-brief', null, { weekKey });

  return brief;
};

module.exports = {
  getCopilotSummary,
  getCashflowForecast,
  getAnomalies,
  submitAnomalyFeedback,
  getSubscriptionsInsights,
  parseReceiptOcr,
  simulateCashflowWhatIf,
  getDebtPayoffPlan,
  getFinancialCalendar,
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
  getHouseholdById,
  listHouseholdMembers,
  updateHouseholdMemberRole,
  createHousehold,
  joinHouseholdByInvite,
  listActivityTimeline,
  exportActivityTimelineCsv,
  verifyActivityIntegrity,
  getTaxSummary,
  getGoalOptimizer,
  listGoalAutopilotRules,
  upsertGoalAutopilotRule,
  deleteGoalAutopilotRule,
  projectGoalAutopilot,
  getExecutiveBrief,
  getWeeklyCfoBrief,
  getFinancialHealthScore,
  getAutoCategorySuggestions,
  submitAutoCategoryFeedback,
  reconcileStatementRows,
  setHouseholdSpendingLimit,
  listHouseholdSpendingLimits,
  createHouseholdApprovalRequest,
  listHouseholdApprovals,
  decideHouseholdApproval,
  listApprovalComments,
  addApprovalComment,
};
