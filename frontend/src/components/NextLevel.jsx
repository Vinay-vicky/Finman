import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Wallet, Repeat, SlidersHorizontal, CalendarClock, Users, Receipt, Target, Briefcase, BrainCircuit, Pencil, Trash2, Download, X } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AuthContext } from '../context/AuthContext';
import { apiDownload, apiRequest } from '../services/api';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const ActionCard = ({ title, subtitle, icon: Icon, status, children }) => (
  <section className="glass-panel p-5 rounded-2xl border border-slate-700/50">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-white text-lg font-semibold">{title}</h3>
        <p className="text-slate-400 text-sm">{subtitle}</p>
        {status && (
          <p className="text-[11px] mt-1 text-slate-500">
            {status.loading ? 'Syncing…' : `Last updated: ${status.updatedAt || '—'}`}
          </p>
        )}
      </div>
      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Icon size={18} />
      </div>
    </div>
    {children}
  </section>
);

const EmptyState = ({ text = 'No data yet.' }) => <div className="text-slate-400 text-sm mt-3">{text}</div>;
const ErrorState = ({ error }) => (error ? <div className="mt-3 text-red-300 text-sm">{error}</div> : null);

const downloadCsv = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const toCsv = (rows, columns) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => esc(c.value(row))).join(',')).join('\n');
  return `${header}\n${body}`;
};

const toInputDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const getDefaultActivityQuery = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    page: 1,
    limit: 8,
    action: '',
    entityType: '',
    from: toInputDate(from),
    to: toInputDate(to),
  };
};

const Pager = ({ data, onPrev, onNext }) => {
  const page = data?.page || 1;
  const totalPages = data?.totalPages || 1;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-300">
      <span>Page {page} / {totalPages}</span>
      <button className="btn-secondary !py-1 !px-2" disabled={page <= 1} onClick={onPrev}>Prev</button>
      <button className="btn-secondary !py-1 !px-2" disabled={page >= totalPages} onClick={onNext}>Next</button>
    </div>
  );
};

const NextLevel = () => {
  const { token } = useContext(AuthContext);
  const [results, setResults] = useState({});
  const [loadingKey, setLoadingKey] = useState('');
  const [activeLoads, setActiveLoads] = useState({});
  const [lastUpdated, setLastUpdated] = useState({});

  const [netWorthForm, setNetWorthForm] = useState({ name: '', kind: 'asset', value: '' });
  const [scenarioForm, setScenarioForm] = useState({ monthlySavingsBoost: 200, expenseCutPct: 5, months: 12 });
  const [ruleForm, setRuleForm] = useState({
    name: 'Groceries auto-tag',
    field: 'title',
    operator: 'contains',
    value: 'mart',
    action_type: 'set_category',
    action_value: 'Groceries',
  });
  const [ruleSample, setRuleSample] = useState({ title: 'SuperMart Monthly', amount: 120, category: 'Other', type: 'expense' });
  const [billForm, setBillForm] = useState({ name: 'Internet', amount: 49.99, due_day: 10, category: 'Utilities' });
  const [householdName, setHouseholdName] = useState('Family HQ');
  const [inviteCode, setInviteCode] = useState('');
  const [activeHousehold, setActiveHousehold] = useState(null);
  const [householdWorkspace, setHouseholdWorkspace] = useState(null);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState({});
  const [netWorthQuery, setNetWorthQuery] = useState({ page: 1, limit: 5, search: '', kind: '' });
  const [rulesQuery, setRulesQuery] = useState({ page: 1, limit: 5, search: '' });
  const [billsQuery, setBillsQuery] = useState({ page: 1, limit: 5, search: '' });
  const [householdsQuery, setHouseholdsQuery] = useState({ page: 1, limit: 5, search: '' });
  const [activityQuery, setActivityQuery] = useState(() => getDefaultActivityQuery());
  const [activityIntegrity, setActivityIntegrity] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedNetWorthIds, setSelectedNetWorthIds] = useState([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [undoHistory, setUndoHistory] = useState([]);
  const pendingUndoRef = useRef(new Map());

  const addUndoHistory = (entry) => {
    setUndoHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 12));
  };

  const pushToast = (type, message, extra = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, type, message, ...extra }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const callApi = async (key, path, options = {}, feedback = {}) => {
    setLoadingKey(key);
    setActiveLoads((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await apiRequest(path, { token, ...options });
      setResults((prev) => ({ ...prev, [key]: data }));
      setLastUpdated((prev) => ({ ...prev, [key]: Date.now() }));
      if (feedback.success) pushToast('success', feedback.success);
      return data;
    } catch (err) {
      setResults((prev) => ({ ...prev, [key]: { error: err.message } }));
      if (feedback.error !== false) pushToast('error', feedback.error || err.message || 'Request failed.');
      return null;
    } finally {
      setLoadingKey('');
      setActiveLoads((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getStatus = (...keys) => ({
    loading: keys.some((k) => Boolean(activeLoads[k])),
    updatedAt: (() => {
      const latestTs = keys
        .map((k) => Number(lastUpdated[k] || 0))
        .filter((v) => Number.isFinite(v) && v > 0)
        .reduce((max, curr) => (curr > max ? curr : max), 0);
      return latestTs ? new Date(latestTs).toLocaleString() : null;
    })(),
  });

  const qs = (params = {}) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') usp.set(k, String(v));
    });
    return usp.toString() ? `?${usp.toString()}` : '';
  };

  const features = useMemo(
    () => [
      { id: 'copilot', title: 'AI Finance Copilot', icon: BrainCircuit },
      { id: 'forecast', title: 'Predictive Cashflow', icon: TrendingUp },
      { id: 'anomalies', title: 'Anomaly Detection', icon: AlertTriangle },
      { id: 'networth', title: 'Net Worth Tracker', icon: Wallet },
      { id: 'subscriptions', title: 'Subscription Intelligence', icon: Repeat },
      { id: 'rules', title: 'Automation Rules Engine', icon: SlidersHorizontal },
      { id: 'bills', title: 'Bill Calendar Intelligence', icon: CalendarClock },
      { id: 'households', title: 'Family Spaces', icon: Users },
      { id: 'tax', title: 'Tax Workspace', icon: Receipt },
      { id: 'goals', title: 'Smart Goal Optimizer', icon: Target },
      { id: 'executive', title: 'Executive Brief', icon: Briefcase },
      { id: 'scenario', title: 'Scenario Lab', icon: Sparkles },
    ],
    []
  );

  const exportRows = (filenamePrefix, rows, columns) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      pushToast('error', 'No rows to export.');
      return;
    }
    const csv = toCsv(rows, columns);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`${filenamePrefix}-${date}.csv`, csv);
    pushToast('success', `Exported ${rows.length} row(s) to CSV.`);
  };

  const loadNetWorth = (query = netWorthQuery) => callApi('networth', `/api/next-level/networth${qs(query)}`, {}, { error: false });
  const loadRules = (query = rulesQuery) => callApi('rules', `/api/next-level/rules${qs(query)}`, {}, { error: false });
  const loadBills = (query = billsQuery) => callApi('bills', `/api/next-level/bills${qs(query)}`, {}, { error: false });
  const loadHouseholds = (query = householdsQuery) => callApi('households', `/api/next-level/households${qs(query)}`, {}, { error: false });
  const openHousehold = async (id) => {
    const data = await callApi('household-access', `/api/next-level/households/${id}`, {}, { error: 'Unable to open household.' });
    if (data) {
      setActiveHousehold(data);
      const workspace = await callApi('household-members', `/api/next-level/households/${id}/members`, {}, { error: false });
      if (workspace) {
        setHouseholdWorkspace(workspace);
        const drafts = {};
        (workspace.members || []).forEach((m) => {
          drafts[m.userId] = m.role;
        });
        setMemberRoleDrafts(drafts);
      }
      pushToast('success', `Opened household: ${data.name}`);
    }
  };

  const updateHouseholdMemberRole = async (householdId, memberUserId) => {
    const role = memberRoleDrafts[memberUserId];
    if (!role) return;

    const updated = await callApi(
      'household-member-role',
      `/api/next-level/households/${householdId}/members/${memberUserId}`,
      { method: 'PATCH', body: { role } },
      { success: 'Member role updated.' }
    );

    if (updated) {
      const workspace = await callApi('household-members', `/api/next-level/households/${householdId}/members`, {}, { error: false });
      if (workspace) {
        setHouseholdWorkspace(workspace);
      }
    }
  };
  const loadActivityTimeline = (query = activityQuery) => callApi('activity', `/api/next-level/activity${qs(query)}`, {}, { error: false });
  const loadActivityIntegrity = async () => {
    const data = await apiRequest('/api/next-level/activity/integrity', { token });
    setActivityIntegrity(data);
    setLastUpdated((prev) => ({ ...prev, 'activity-integrity': Date.now() }));
    return data;
  };

  useEffect(() => {
    if (!token) return;
    loadActivityIntegrity().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => loadNetWorth(netWorthQuery), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, netWorthQuery]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => loadRules(rulesQuery), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rulesQuery]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => loadBills(billsQuery), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, billsQuery]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => loadHouseholds(householdsQuery), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, householdsQuery]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => loadActivityTimeline(activityQuery), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activityQuery]);

  const toggleSelected = (setter, current, id) => {
    setter(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const toggleAllSelected = (setter, current, rows = []) => {
    const ids = rows.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => current.includes(id));
    if (allSelected) {
      setter(current.filter((id) => !ids.includes(id)));
      return;
    }

    const merged = new Set([...current, ...ids]);
    setter([...merged]);
  };

  const recomputeNetWorthTotalsFromItems = (items) => {
    const assets = items.filter((r) => r.kind === 'asset').reduce((a, r) => a + Number(r.value || 0), 0);
    const liabilities = items.filter((r) => r.kind === 'liability').reduce((a, r) => a + Number(r.value || 0), 0);
    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  };

  const optimisticRemoveRows = (resultKey, idsToRemove, opts = {}) => {
    setResults((prev) => {
      const target = prev[resultKey];
      if (!target || !Array.isArray(target.items)) return prev;

      const kept = target.items.filter((row) => !idsToRemove.includes(row.id));
      const total = Math.max(0, Number(target.total || 0) - idsToRemove.length);
      let next = {
        ...target,
        items: kept,
        total,
        totalPages: Math.max(1, Math.ceil(total / Number(target.limit || 1))),
      };

      if (opts.recomputeNetWorthTotals) {
        const { assets, liabilities, netWorth } = recomputeNetWorthTotalsFromItems(kept);
        next = {
          ...next,
          totals: {
            assets,
            liabilities,
            netWorth,
          },
        };
      }

      return { ...prev, [resultKey]: next };
    });
  };

  const restoreRows = (resultKey, removedRows, opts = {}) => {
    setResults((prev) => {
      const target = prev[resultKey];
      if (!target || !Array.isArray(target.items)) return prev;

      const dedup = new Map();
      [...removedRows, ...target.items].forEach((row) => dedup.set(row.id, row));
      const merged = [...dedup.values()];
      const total = Number(target.total || 0) + removedRows.length;
      let next = {
        ...target,
        items: merged,
        total,
        totalPages: Math.max(1, Math.ceil(total / Number(target.limit || 1))),
      };

      if (opts.recomputeNetWorthTotals) {
        const { assets, liabilities, netWorth } = recomputeNetWorthTotalsFromItems(merged);
        next = {
          ...next,
          totals: {
            assets,
            liabilities,
            netWorth,
          },
        };
      }

      return { ...prev, [resultKey]: next };
    });
  };

  const scheduleUndoableDelete = ({
    key,
    ids,
    rows,
    resultKey,
    entityLabel = 'items',
    commitDelete,
    onRestore,
    optimisticOptions,
  }) => {
    if (!ids.length) {
      pushToast('error', 'Select at least one row.');
      return;
    }

    optimisticRemoveRows(resultKey, ids, optimisticOptions);
    const undoId = `${key}-${Date.now()}`;

    const timeout = setTimeout(async () => {
      try {
        for (const id of ids) {
          // eslint-disable-next-line no-await-in-loop
          await commitDelete(id);
        }
        pushToast('success', `${ids.length} item(s) deleted.`);
        addUndoHistory({ action: `Deleted ${entityLabel}`, count: ids.length, status: 'committed' });
      } catch (err) {
        restoreRows(resultKey, rows, optimisticOptions);
        pushToast('error', err.message || 'Delete failed. Items restored.');
        addUndoHistory({ action: `Deleted ${entityLabel}`, count: ids.length, status: 'failed' });
      } finally {
        pendingUndoRef.current.delete(undoId);
      }
    }, 5000);

    pendingUndoRef.current.set(undoId, {
      timeout,
      restore: () => {
        clearTimeout(timeout);
        restoreRows(resultKey, rows, optimisticOptions);
        if (onRestore) onRestore();
        pendingUndoRef.current.delete(undoId);
      },
    });

    pushToast('warning', `${ids.length} item(s) queued for deletion.`, {
      actionLabel: 'Undo',
      onAction: () => {
        const pending = pendingUndoRef.current.get(undoId);
        if (!pending) return;
        pending.restore();
        pushToast('success', 'Deletion undone.');
        addUndoHistory({ action: `Deleted ${entityLabel}`, count: ids.length, status: 'undone' });
      },
    });
  };

  const editNetWorth = (item) => {
    setNetWorthForm({
      id: item.id,
      name: item.name,
      kind: item.kind,
      value: String(item.value),
    });
    pushToast('success', 'Loaded item into form for editing.');
  };

  const deleteNetWorth = async (id) => {
    const rows = (results.networth?.items || []).filter((r) => r.id === id);
    scheduleUndoableDelete({
      key: 'networth-single',
      ids: [id],
      rows,
      resultKey: 'networth',
      optimisticOptions: { recomputeNetWorthTotals: true },
      commitDelete: (rowId) => apiRequest(`/api/next-level/networth/${rowId}`, { method: 'DELETE', token }),
      onRestore: () => setSelectedNetWorthIds([]),
    });
  };

  const bulkDeleteNetWorth = () => {
    const ids = selectedNetWorthIds;
    const rows = (results.networth?.items || []).filter((r) => ids.includes(r.id));
    scheduleUndoableDelete({
      key: 'networth-bulk',
      ids,
      rows,
      resultKey: 'networth',
      optimisticOptions: { recomputeNetWorthTotals: true },
      commitDelete: (rowId) => apiRequest(`/api/next-level/networth/${rowId}`, { method: 'DELETE', token }),
      onRestore: () => setSelectedNetWorthIds([]),
    });
    setSelectedNetWorthIds([]);
  };

  const editRule = (rule) => {
    setRuleForm({
      id: rule.id,
      name: rule.name,
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
      action_type: rule.action_type,
      action_value: rule.action_value,
    });
    pushToast('success', 'Loaded rule into form for editing.');
  };

  const deleteRule = async (id) => {
    const rows = (results.rules?.items || []).filter((r) => r.id === id);
    scheduleUndoableDelete({
      key: 'rules-single',
      ids: [id],
      rows,
      resultKey: 'rules',
      commitDelete: (rowId) => apiRequest(`/api/next-level/rules/${rowId}`, { method: 'DELETE', token }),
      onRestore: () => setSelectedRuleIds([]),
    });
  };

  const bulkDeleteRules = () => {
    const ids = selectedRuleIds;
    const rows = (results.rules?.items || []).filter((r) => ids.includes(r.id));
    scheduleUndoableDelete({
      key: 'rules-bulk',
      ids,
      rows,
      resultKey: 'rules',
      commitDelete: (rowId) => apiRequest(`/api/next-level/rules/${rowId}`, { method: 'DELETE', token }),
      onRestore: () => setSelectedRuleIds([]),
    });
    setSelectedRuleIds([]);
  };

  const editBill = (bill) => {
    setBillForm({
      id: bill.id,
      name: bill.name,
      amount: Number(bill.amount),
      due_day: Number(bill.due_day),
      category: bill.category || '',
    });
    pushToast('success', 'Loaded bill into form for editing.');
  };

  const deleteBill = async (id) => {
    const rows = (results.bills?.items || []).filter((r) => r.id === id);
    scheduleUndoableDelete({
      key: 'bills-single',
      ids: [id],
      rows,
      resultKey: 'bills',
      commitDelete: (rowId) => apiRequest(`/api/next-level/bills/${rowId}`, { method: 'DELETE', token }),
      onRestore: () => setSelectedBillIds([]),
    });
  };

  const bulkDeleteBills = () => {
    const ids = selectedBillIds;
    const rows = (results.bills?.items || []).filter((r) => ids.includes(r.id));
    scheduleUndoableDelete({
      key: 'bills-bulk',
      ids,
      rows,
      resultKey: 'bills',
      commitDelete: (rowId) => apiRequest(`/api/next-level/bills/${rowId}`, { method: 'DELETE', token }),
      onRestore: () => setSelectedBillIds([]),
    });
    setSelectedBillIds([]);
  };

  const optimisticUpsert = async ({
    resultKey,
    payload,
    isEdit,
    keyField = 'id',
    optimisticRow,
    requestPath,
    onSuccess,
    onFail,
    recomputeNetWorthTotals = false,
  }) => {
    const tempId = -Date.now();
    const rowId = isEdit ? payload[keyField] : tempId;
    const rollbackSnapshot = { target: null, existed: false };

    setResults((prev) => {
      const target = prev[resultKey];
      if (!target || !Array.isArray(target.items)) return prev;

      const items = [...target.items];
      const index = items.findIndex((i) => i[keyField] === payload[keyField]);
      rollbackSnapshot.existed = index >= 0;
      rollbackSnapshot.target = index >= 0 ? { ...items[index] } : null;

      if (index >= 0) items[index] = { ...items[index], ...optimisticRow, [keyField]: rowId };
      else items.unshift({ ...optimisticRow, [keyField]: rowId });

      let next = {
        ...target,
        items,
        total: index >= 0 ? target.total : Number(target.total || 0) + 1,
        totalPages: Math.max(1, Math.ceil((index >= 0 ? Number(target.total || 0) : Number(target.total || 0) + 1) / Number(target.limit || 1))),
      };

      if (recomputeNetWorthTotals) {
        next = { ...next, totals: recomputeNetWorthTotalsFromItems(items) };
      }

      return { ...prev, [resultKey]: next };
    });

    try {
      const saved = await apiRequest(requestPath, { method: 'POST', body: payload, token });
      setResults((prev) => {
        const target = prev[resultKey];
        if (!target || !Array.isArray(target.items)) return prev;

        const items = target.items.map((i) => (i[keyField] === rowId ? saved : i));
        let next = { ...target, items };
        if (recomputeNetWorthTotals) next = { ...next, totals: recomputeNetWorthTotalsFromItems(items) };
        return { ...prev, [resultKey]: next };
      });
      if (onSuccess) onSuccess(saved);
      return saved;
    } catch (err) {
      setResults((prev) => {
        const target = prev[resultKey];
        if (!target || !Array.isArray(target.items)) return prev;

        let items = [...target.items];
        const idx = items.findIndex((i) => i[keyField] === rowId);
        if (idx >= 0) {
          if (rollbackSnapshot.existed) items[idx] = rollbackSnapshot.target;
          else items.splice(idx, 1);
        }

        let next = {
          ...target,
          items,
          total: rollbackSnapshot.existed ? target.total : Math.max(0, Number(target.total || 0) - 1),
          totalPages: Math.max(1, Math.ceil((rollbackSnapshot.existed ? Number(target.total || 0) : Math.max(0, Number(target.total || 0) - 1)) / Number(target.limit || 1))),
        };

        if (recomputeNetWorthTotals) next = { ...next, totals: recomputeNetWorthTotalsFromItems(items) };
        return { ...prev, [resultKey]: next };
      });

      if (onFail) onFail(err);
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur bg-slate-900/90 flex items-start justify-between gap-2 ${
              t.type === 'error'
                ? 'border-red-500/40 text-red-200'
                : t.type === 'warning'
                  ? 'border-amber-500/40 text-amber-200'
                  : 'border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex-1">
              <span>{t.message}</span>
              {t.actionLabel && typeof t.onAction === 'function' && (
                <div className="mt-1">
                  <button
                    className="text-xs px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30"
                    onClick={t.onAction}
                  >
                    {t.actionLabel}
                  </button>
                </div>
              )}
            </div>
            <button className="text-slate-300 hover:text-white" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {undoHistory.length > 0 && (
        <div className="fixed bottom-2 left-2 right-2 md:bottom-4 md:right-4 md:left-auto z-[60] md:w-[360px] max-w-[calc(100vw-1rem)] glass-panel p-3 border border-slate-700/70">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-200 tracking-wide">Undo History</h4>
            <button className="text-[10px] text-slate-400 hover:text-white" onClick={() => setUndoHistory([])}>Clear</button>
          </div>
          <ul className="max-h-32 md:max-h-40 overflow-auto space-y-1">
            {undoHistory.map((h) => (
              <li key={h.id} className="text-[11px] text-slate-300 bg-slate-900/60 rounded px-2 py-1 border border-slate-800 flex items-center justify-between gap-2">
                <span className="truncate">{h.action} ({h.count})</span>
                <span className={`capitalize shrink-0 ${h.status === 'failed' ? 'text-red-300' : h.status === 'undone' ? 'text-amber-300' : 'text-emerald-300'}`}>{h.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <header className="glass-panel p-6 rounded-2xl border border-emerald-500/20">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Next-Level Finance Suite</h2>
        <p className="text-slate-300 text-sm md:text-base">
          All 12 advanced features are now available in v1. Each module is live and connected to backend APIs.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {features.map((f) => (
            <span key={f.id} className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
              {f.title}
            </span>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ActionCard title="1) AI Finance Copilot" subtitle="Narrative summary and recommendation" icon={BrainCircuit}>
          <button className="btn-primary" onClick={() => callApi('copilot', '/api/next-level/copilot/summary')}>
            {loadingKey === 'copilot' ? 'Loading…' : 'Generate Summary'}
          </button>
          {results.copilot?.headline ? (
            <>
              <p className="mt-3 text-sm text-emerald-300">{results.copilot.headline}</p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Income</p><p className="text-white font-semibold">{money(results.copilot.stats?.income)}</p></div>
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Expense</p><p className="text-white font-semibold">{money(results.copilot.stats?.expense)}</p></div>
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Net</p><p className="text-white font-semibold">{money(results.copilot.stats?.net)}</p></div>
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Top Category</p><p className="text-white font-semibold">{results.copilot.stats?.topExpenseCategory || 'N/A'}</p></div>
              </div>
              <p className="mt-3 text-xs text-slate-300">Tip: {results.copilot.recommendation}</p>
            </>
          ) : (
            <EmptyState text="Generate a summary to see insight cards." />
          )}
          <ErrorState error={results.copilot?.error} />
        </ActionCard>

        <ActionCard title="2) Predictive Cashflow" subtitle="Project forward balances" icon={TrendingUp}>
          <button className="btn-primary" onClick={() => callApi('forecast', '/api/next-level/cashflow/forecast?months=6')}>
            {loadingKey === 'forecast' ? 'Loading…' : 'Run Forecast'}
          </button>
          {Array.isArray(results.forecast?.projection) && results.forecast.projection.length > 0 ? (
            <>
              <div className="h-48 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.forecast.projection}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="monthOffset" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip formatter={(value) => money(value)} />
                    <Line type="monotone" dataKey="projectedBalance" stroke="#34d399" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-300">Average monthly net: <span className="text-emerald-300 font-semibold">{money(results.forecast.averageMonthlyNet)}</span></p>
            </>
          ) : (
            <EmptyState text="Run forecast to render trend chart." />
          )}
          <ErrorState error={results.forecast?.error} />
        </ActionCard>

        <ActionCard title="3) Anomaly Detection" subtitle="Detect unusually large expenses" icon={AlertTriangle}>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => callApi('anomalies', '/api/next-level/transactions/anomalies')}>
              {loadingKey === 'anomalies' ? 'Loading…' : 'Find Anomalies'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => exportRows('anomalies', results.anomalies?.anomalies || [], [
                { label: 'Title', value: (r) => r.title },
                { label: 'Category', value: (r) => r.category },
                { label: 'Amount', value: (r) => r.amount },
                { label: 'Date', value: (r) => r.date },
              ])}
            >
              <Download size={14} className="inline mr-1" /> CSV
            </button>
          </div>
          {Array.isArray(results.anomalies?.anomalies) ? (
            <>
              <p className="mt-3 text-xs text-slate-300">Threshold: <span className="text-amber-300">{money(results.anomalies.threshold)}</span></p>
              <div className="mt-2 overflow-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs text-slate-300">
                  <thead className="bg-slate-900/70 text-slate-400">
                    <tr><th className="p-2 text-left">Title</th><th className="p-2 text-left">Category</th><th className="p-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {results.anomalies.anomalies.map((a) => (
                      <tr key={a.id} className="border-t border-slate-800"><td className="p-2">{a.title}</td><td className="p-2">{a.category}</td><td className="p-2 text-right text-red-300">{money(a.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState text="Run anomaly scan to view flagged transactions." />
          )}
          <ErrorState error={results.anomalies?.error} />
        </ActionCard>

        <ActionCard title="4) Net Worth Tracker" subtitle="Track assets and liabilities" icon={Wallet} status={getStatus('networth', 'networth-save')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="input-glass" placeholder="Name" value={netWorthForm.name} onChange={(e) => setNetWorthForm((p) => ({ ...p, name: e.target.value }))} />
            <select className="input-glass" value={netWorthForm.kind} onChange={(e) => setNetWorthForm((p) => ({ ...p, kind: e.target.value }))}>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
            <input className="input-glass" placeholder="Value" type="number" value={netWorthForm.value} onChange={(e) => setNetWorthForm((p) => ({ ...p, value: e.target.value }))} />
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                const payload = { ...netWorthForm, value: Number(netWorthForm.value || 0) };
                const hasListContext = Array.isArray(results.networth?.items);
                if (!hasListContext) {
                  const ok = await callApi('networth-save', '/api/next-level/networth', { method: 'POST', body: payload }, { success: payload.id ? 'Net worth item updated.' : 'Net worth item created.' });
                  if (ok) {
                    setNetWorthForm({ name: '', kind: 'asset', value: '' });
                    loadNetWorth();
                  }
                  return;
                }

                const saved = await optimisticUpsert({
                  resultKey: 'networth',
                  payload,
                  isEdit: Boolean(payload.id),
                  optimisticRow: {
                    ...payload,
                    as_of: new Date().toISOString(),
                  },
                  requestPath: '/api/next-level/networth',
                  recomputeNetWorthTotals: true,
                  onSuccess: () => pushToast('success', payload.id ? 'Net worth item updated.' : 'Net worth item created.'),
                  onFail: (err) => pushToast('error', err.message || 'Failed to save net worth item. Rolled back.'),
                });

                if (saved) {
                  setNetWorthForm({ name: '', kind: 'asset', value: '' });
                }
              }}
            >
              {netWorthForm.id ? 'Update Item' : 'Save Item'}
            </button>
            <button className="btn-secondary" disabled={Boolean(activeLoads.networth)} onClick={() => loadNetWorth(netWorthQuery)}>
              {activeLoads.networth ? 'Refreshing…' : 'Refresh Net Worth'}
            </button>
            <button className="btn-secondary" disabled={selectedNetWorthIds.length === 0} onClick={bulkDeleteNetWorth}>
              <Trash2 size={14} className="inline mr-1" /> Delete Selected ({selectedNetWorthIds.length})
            </button>
            <button className="btn-secondary" onClick={() => setNetWorthForm({ name: '', kind: 'asset', value: '' })}>Clear</button>
            <button
              className="btn-secondary"
              onClick={() => exportRows('networth', results.networth?.items || [], [
                { label: 'Name', value: (r) => r.name },
                { label: 'Kind', value: (r) => r.kind },
                { label: 'Value', value: (r) => r.value },
                { label: 'As Of', value: (r) => r.as_of },
              ])}
            ><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className="input-glass" placeholder="Search name" value={netWorthQuery.search} onChange={(e) => setNetWorthQuery((p) => ({ ...p, search: e.target.value, page: 1 }))} />
            <select className="input-glass" value={netWorthQuery.kind} onChange={(e) => setNetWorthQuery((p) => ({ ...p, kind: e.target.value, page: 1 }))}>
              <option value="">All kinds</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Selected across pages: {selectedNetWorthIds.length}</span>
            <button className="text-slate-300 hover:text-white" onClick={() => setSelectedNetWorthIds([])}>Clear selection</button>
          </div>
          {results.networth?.totals ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Assets</p><p className="text-emerald-300 font-semibold">{money(results.networth.totals.assets)}</p></div>
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Liabilities</p><p className="text-red-300 font-semibold">{money(results.networth.totals.liabilities)}</p></div>
                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Net Worth</p><p className="text-white font-semibold">{money(results.networth.totals.netWorth)}</p></div>
              </div>
              <div className="mt-2 overflow-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs text-slate-300">
                  <thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-2 text-left"><input type="checkbox" checked={results.networth.items?.length > 0 && results.networth.items.every((i) => selectedNetWorthIds.includes(i.id))} onChange={() => toggleAllSelected(setSelectedNetWorthIds, selectedNetWorthIds, results.networth.items || [])} /></th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Kind</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Actions</th></tr></thead>
                  <tbody>
                    {results.networth.items?.map((i) => (
                      <tr key={i.id} className="border-t border-slate-800"><td className="p-2"><input type="checkbox" checked={selectedNetWorthIds.includes(i.id)} onChange={() => toggleSelected(setSelectedNetWorthIds, selectedNetWorthIds, i.id)} /></td><td className="p-2">{i.name}</td><td className="p-2 capitalize">{i.kind}</td><td className="p-2 text-right">{money(i.value)}</td><td className="p-2 text-right"><button className="text-emerald-300 mr-2" onClick={() => editNetWorth(i)}><Pencil size={14} /></button><button className="text-red-300" onClick={() => deleteNetWorth(i.id)}><Trash2 size={14} /></button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                data={results.networth}
                onPrev={() => {
                  const next = { ...netWorthQuery, page: Math.max(1, netWorthQuery.page - 1) };
                  setNetWorthQuery(next);
                  loadNetWorth(next);
                }}
                onNext={() => {
                  const next = { ...netWorthQuery, page: netWorthQuery.page + 1 };
                  setNetWorthQuery(next);
                  loadNetWorth(next);
                }}
              />
            </>
          ) : (
            <EmptyState text="Save or refresh to load net worth table." />
          )}
          <ErrorState error={results.networth?.error || results['networth-save']?.error} />
        </ActionCard>

        <ActionCard title="5) Subscription Intelligence" subtitle="Detect repeat spend candidates" icon={Repeat}>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => callApi('subscriptions', '/api/next-level/subscriptions/insights')}>
              {loadingKey === 'subscriptions' ? 'Loading…' : 'Analyze Subscriptions'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => exportRows('subscriptions', results.subscriptions?.candidates || [], [
                { label: 'Title', value: (r) => r.title },
                { label: 'Category', value: (r) => r.category },
                { label: 'Occurrences', value: (r) => r.occurrences },
                { label: 'Avg Amount', value: (r) => r.avgAmount },
              ])}
            ><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          {Array.isArray(results.subscriptions?.candidates) ? (
            <div className="mt-3 overflow-auto rounded-xl border border-slate-700">
              <table className="w-full text-xs text-slate-300">
                <thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-2 text-left">Title</th><th className="p-2 text-right">Avg</th><th className="p-2 text-right">Freq</th></tr></thead>
                <tbody>
                  {results.subscriptions.candidates.slice(0, 8).map((s, idx) => (
                    <tr key={`${s.title}-${idx}`} className="border-t border-slate-800"><td className="p-2">{s.title}</td><td className="p-2 text-right">{money(s.avgAmount)}</td><td className="p-2 text-right">{s.occurrences}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState text="Run analysis to list repeating payments." />}
          <ErrorState error={results.subscriptions?.error} />
        </ActionCard>

        <ActionCard title="6) Rules Engine" subtitle="Auto-tagging and transformation rules" icon={SlidersHorizontal} status={getStatus('rules', 'rule-save', 'rule-sim')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="input-glass" placeholder="Rule name" value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} />
            <select className="input-glass" value={ruleForm.field} onChange={(e) => setRuleForm((p) => ({ ...p, field: e.target.value }))}>
              <option value="title">title</option>
              <option value="category">category</option>
              <option value="amount">amount</option>
              <option value="type">type</option>
            </select>
            <select className="input-glass" value={ruleForm.operator} onChange={(e) => setRuleForm((p) => ({ ...p, operator: e.target.value }))}>
              <option value="contains">contains</option>
              <option value="equals">equals</option>
              <option value="gt">gt</option>
              <option value="lt">lt</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <input className="input-glass" placeholder="Match value" value={ruleForm.value} onChange={(e) => setRuleForm((p) => ({ ...p, value: e.target.value }))} />
            <select className="input-glass" value={ruleForm.action_type} onChange={(e) => setRuleForm((p) => ({ ...p, action_type: e.target.value }))}>
              <option value="set_category">set_category</option>
              <option value="set_type">set_type</option>
              <option value="set_title">set_title</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-2 mt-2">
            <input className="input-glass" placeholder="Action value" value={ruleForm.action_value} onChange={(e) => setRuleForm((p) => ({ ...p, action_value: e.target.value }))} />
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            <button className="btn-primary" onClick={async () => {
              const hasListContext = Array.isArray(results.rules?.items);
              if (!hasListContext) {
                const ok = await callApi('rule-save', '/api/next-level/rules', { method: 'POST', body: ruleForm }, { success: ruleForm.id ? 'Rule updated.' : 'Rule created.' });
                if (ok) {
                  setRuleForm({ name: 'Groceries auto-tag', field: 'title', operator: 'contains', value: 'mart', action_type: 'set_category', action_value: 'Groceries' });
                  loadRules();
                }
                return;
              }

              const saved = await optimisticUpsert({
                resultKey: 'rules',
                payload: ruleForm,
                isEdit: Boolean(ruleForm.id),
                optimisticRow: { ...ruleForm, enabled: ruleForm.enabled === false ? 0 : 1 },
                requestPath: '/api/next-level/rules',
                onSuccess: () => pushToast('success', ruleForm.id ? 'Rule updated.' : 'Rule created.'),
                onFail: (err) => pushToast('error', err.message || 'Failed to save rule. Rolled back.'),
              });

              if (saved) {
                setRuleForm({ name: 'Groceries auto-tag', field: 'title', operator: 'contains', value: 'mart', action_type: 'set_category', action_value: 'Groceries' });
              }
            }}>{ruleForm.id ? 'Update Rule' : 'Save Rule'}</button>
            <button className="btn-secondary" disabled={Boolean(activeLoads.rules)} onClick={() => loadRules(rulesQuery)}>{activeLoads.rules ? 'Loading…' : 'List Rules'}</button>
            <button className="btn-secondary" disabled={selectedRuleIds.length === 0} onClick={bulkDeleteRules}><Trash2 size={14} className="inline mr-1" /> Delete Selected ({selectedRuleIds.length})</button>
            <button className="btn-secondary" onClick={() => setRuleForm({ name: 'Groceries auto-tag', field: 'title', operator: 'contains', value: 'mart', action_type: 'set_category', action_value: 'Groceries' })}>Clear</button>
            <button className="btn-secondary" onClick={() => exportRows('rules', results.rules?.items || [], [
              { label: 'Name', value: (r) => r.name },
              { label: 'Field', value: (r) => r.field },
              { label: 'Operator', value: (r) => r.operator },
              { label: 'Value', value: (r) => r.value },
              { label: 'Action Type', value: (r) => r.action_type },
              { label: 'Action Value', value: (r) => r.action_value },
            ])}><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
            <input className="input-glass" placeholder="Sample title" value={ruleSample.title} onChange={(e) => setRuleSample((p) => ({ ...p, title: e.target.value }))} />
            <input className="input-glass" placeholder="Amount" type="number" value={ruleSample.amount} onChange={(e) => setRuleSample((p) => ({ ...p, amount: Number(e.target.value || 0) }))} />
            <input className="input-glass" placeholder="Category" value={ruleSample.category} onChange={(e) => setRuleSample((p) => ({ ...p, category: e.target.value }))} />
            <select className="input-glass" value={ruleSample.type} onChange={(e) => setRuleSample((p) => ({ ...p, type: e.target.value }))}>
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-1 gap-2">
            <button className="btn-secondary" disabled={Boolean(activeLoads['rule-sim'])} onClick={() => callApi('rule-sim', '/api/next-level/rules/simulate', { method: 'POST', body: ruleSample })}>{activeLoads['rule-sim'] ? 'Simulating…' : 'Simulate'}</button>
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="input-glass" placeholder="Search rules" value={rulesQuery.search} onChange={(e) => setRulesQuery((p) => ({ ...p, search: e.target.value, page: 1 }))} />
            <button className="btn-secondary" onClick={() => loadRules(rulesQuery)}>Apply Search</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Selected across pages: {selectedRuleIds.length}</span>
            <button className="text-slate-300 hover:text-white" onClick={() => setSelectedRuleIds([])}>Clear selection</button>
          </div>
          {Array.isArray(results.rules?.items) ? (
            <>
              <div className="mt-2 overflow-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs text-slate-300">
                  <thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-2 text-left"><input type="checkbox" checked={results.rules.items?.length > 0 && results.rules.items.every((r) => selectedRuleIds.includes(r.id))} onChange={() => toggleAllSelected(setSelectedRuleIds, selectedRuleIds, results.rules.items || [])} /></th><th className="p-2 text-left">Rule</th><th className="p-2 text-left">Condition</th><th className="p-2 text-left">Action</th><th className="p-2 text-right">Actions</th></tr></thead>
                  <tbody>
                    {results.rules.items.map((r) => (
                      <tr key={r.id} className="border-t border-slate-800"><td className="p-2"><input type="checkbox" checked={selectedRuleIds.includes(r.id)} onChange={() => toggleSelected(setSelectedRuleIds, selectedRuleIds, r.id)} /></td><td className="p-2">{r.name}</td><td className="p-2">{r.field} {r.operator} {r.value}</td><td className="p-2">{r.action_type} → {r.action_value}</td><td className="p-2 text-right"><button className="text-emerald-300 mr-2" onClick={() => editRule(r)}><Pencil size={14} /></button><button className="text-red-300" onClick={() => deleteRule(r.id)}><Trash2 size={14} /></button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                data={results.rules}
                onPrev={() => {
                  const next = { ...rulesQuery, page: Math.max(1, rulesQuery.page - 1) };
                  setRulesQuery(next);
                  loadRules(next);
                }}
                onNext={() => {
                  const next = { ...rulesQuery, page: rulesQuery.page + 1 };
                  setRulesQuery(next);
                  loadRules(next);
                }}
              />
            </>
          ) : <EmptyState text="Create or list rules to view a table." />}
          {results['rule-sim']?.transformed && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200">
              Simulated output: {results['rule-sim'].transformed.title} • {results['rule-sim'].transformed.category} • {money(results['rule-sim'].transformed.amount)}
            </div>
          )}
          <ErrorState error={results.rules?.error || results['rule-save']?.error || results['rule-sim']?.error} />
        </ActionCard>

        <ActionCard title="7) Bill Calendar" subtitle="Up-next obligations and bill tracking" icon={CalendarClock} status={getStatus('bills', 'bill-save', 'bills-upcoming')}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input className="input-glass" placeholder="Bill name" value={billForm.name} onChange={(e) => setBillForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="input-glass" placeholder="Amount" type="number" value={billForm.amount} onChange={(e) => setBillForm((p) => ({ ...p, amount: Number(e.target.value || 0) }))} />
            <input className="input-glass" placeholder="Due day" type="number" min={1} max={31} value={billForm.due_day} onChange={(e) => setBillForm((p) => ({ ...p, due_day: Number(e.target.value || 1) }))} />
            <input className="input-glass" placeholder="Category" value={billForm.category} onChange={(e) => setBillForm((p) => ({ ...p, category: e.target.value }))} />
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            <button className="btn-primary" onClick={async () => {
              const hasListContext = Array.isArray(results.bills?.items);
              if (!hasListContext) {
                const ok = await callApi('bill-save', '/api/next-level/bills', { method: 'POST', body: billForm }, { success: billForm.id ? 'Bill updated.' : 'Bill created.' });
                if (ok) {
                  setBillForm({ name: 'Internet', amount: 49.99, due_day: 10, category: 'Utilities' });
                  loadBills();
                }
                return;
              }

              const saved = await optimisticUpsert({
                resultKey: 'bills',
                payload: billForm,
                isEdit: Boolean(billForm.id),
                optimisticRow: {
                  ...billForm,
                  active: billForm.active === false ? 0 : 1,
                },
                requestPath: '/api/next-level/bills',
                onSuccess: () => pushToast('success', billForm.id ? 'Bill updated.' : 'Bill created.'),
                onFail: (err) => pushToast('error', err.message || 'Failed to save bill. Rolled back.'),
              });

              if (saved) {
                setBillForm({ name: 'Internet', amount: 49.99, due_day: 10, category: 'Utilities' });
              }
            }}>{billForm.id ? 'Update Bill' : 'Save Bill'}</button>
            <button className="btn-secondary" disabled={Boolean(activeLoads['bills-upcoming'])} onClick={() => callApi('bills-upcoming', '/api/next-level/bills/upcoming?dueWithinDays=30')}>{activeLoads['bills-upcoming'] ? 'Checking…' : 'Upcoming Bills'}</button>
            <button className="btn-secondary" disabled={Boolean(activeLoads.bills)} onClick={() => loadBills(billsQuery)}>{activeLoads.bills ? 'Loading…' : 'List Bills'}</button>
            <button className="btn-secondary" disabled={selectedBillIds.length === 0} onClick={bulkDeleteBills}><Trash2 size={14} className="inline mr-1" /> Delete Selected ({selectedBillIds.length})</button>
            <button className="btn-secondary" onClick={() => setBillForm({ name: 'Internet', amount: 49.99, due_day: 10, category: 'Utilities' })}>Clear</button>
            <button className="btn-secondary" onClick={() => exportRows('bills', results.bills?.items || [], [
              { label: 'Name', value: (r) => r.name },
              { label: 'Amount', value: (r) => r.amount },
              { label: 'Due Day', value: (r) => r.due_day },
              { label: 'Category', value: (r) => r.category },
              { label: 'Active', value: (r) => r.active },
            ])}><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          <div className="mt-2">
            <input className="input-glass" placeholder="Search bills" value={billsQuery.search} onChange={(e) => setBillsQuery((p) => ({ ...p, search: e.target.value, page: 1 }))} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Selected across pages: {selectedBillIds.length}</span>
            <button className="text-slate-300 hover:text-white" onClick={() => setSelectedBillIds([])}>Clear selection</button>
          </div>
          {Array.isArray(results['bills-upcoming']) && (
            <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-200">
              Upcoming: {results['bills-upcoming'].slice(0, 3).map((b) => `${b.name} (${b.daysUntil}d)`).join(', ') || 'None'}
            </div>
          )}
          {Array.isArray(results.bills?.items) ? (
            <>
              <div className="mt-2 overflow-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs text-slate-300">
                  <thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-2 text-left"><input type="checkbox" checked={results.bills.items?.length > 0 && results.bills.items.every((b) => selectedBillIds.includes(b.id))} onChange={() => toggleAllSelected(setSelectedBillIds, selectedBillIds, results.bills.items || [])} /></th><th className="p-2 text-left">Bill</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Due Day</th><th className="p-2 text-right">Actions</th></tr></thead>
                  <tbody>
                    {results.bills.items.map((b) => (
                      <tr key={b.id} className="border-t border-slate-800"><td className="p-2"><input type="checkbox" checked={selectedBillIds.includes(b.id)} onChange={() => toggleSelected(setSelectedBillIds, selectedBillIds, b.id)} /></td><td className="p-2">{b.name}</td><td className="p-2 text-right">{money(b.amount)}</td><td className="p-2 text-right">{b.due_day}</td><td className="p-2 text-right"><button className="text-emerald-300 mr-2" onClick={() => editBill(b)}><Pencil size={14} /></button><button className="text-red-300" onClick={() => deleteBill(b.id)}><Trash2 size={14} /></button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                data={results.bills}
                onPrev={() => {
                  const next = { ...billsQuery, page: Math.max(1, billsQuery.page - 1) };
                  setBillsQuery(next);
                  loadBills(next);
                }}
                onNext={() => {
                  const next = { ...billsQuery, page: billsQuery.page + 1 };
                  setBillsQuery(next);
                  loadBills(next);
                }}
              />
            </>
          ) : <EmptyState text="Save or list bills to view a due-date table." />}
          <ErrorState error={results.bills?.error || results['bill-save']?.error || results['bills-upcoming']?.error} />
        </ActionCard>

        <ActionCard title="8) Family Spaces" subtitle="Shared finance spaces via invite code" icon={Users} status={getStatus('households', 'household-create', 'household-join', 'household-access', 'household-members', 'household-member-role')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="input-glass" placeholder="New household name" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            <button
              className="btn-primary"
              onClick={async () => {
                const created = await callApi(
                  'household-create',
                  '/api/next-level/households',
                  { method: 'POST', body: { name: householdName } },
                  { success: 'Household created.' }
                );
                if (created) {
                  await loadHouseholds({ ...householdsQuery, page: 1 });
                  setHouseholdName('Family HQ');
                  setHouseholdsQuery((p) => ({ ...p, page: 1 }));
                  openHousehold(created.id);
                }
              }}
            >
              Create Household
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <input className="input-glass" placeholder="Invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            <button
              className="btn-secondary"
              onClick={async () => {
                const joined = await callApi(
                  'household-join',
                  '/api/next-level/households/join',
                  { method: 'POST', body: { inviteCode } },
                  { success: 'Joined household.' }
                );
                if (joined) {
                  await loadHouseholds({ ...householdsQuery, page: 1 });
                  setInviteCode('');
                  setHouseholdsQuery((p) => ({ ...p, page: 1 }));
                  openHousehold(joined.id);
                }
              }}
            >
              Join via Code
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="btn-secondary" disabled={Boolean(activeLoads.households)} onClick={() => loadHouseholds(householdsQuery)}>{activeLoads.households ? 'Loading…' : 'List My Households'}</button>
            <button className="btn-secondary" onClick={() => exportRows('households', results.households?.items || [], [
              { label: 'Name', value: (r) => r.name },
              { label: 'Invite Code', value: (r) => r.invite_code },
              { label: 'Role', value: (r) => r.yourRole },
              { label: 'Members', value: (r) => r.memberCount },
              { label: 'Created At', value: (r) => r.createdAt },
            ])}><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          <div className="mt-2">
            <input className="input-glass" placeholder="Search households" value={householdsQuery.search} onChange={(e) => setHouseholdsQuery((p) => ({ ...p, search: e.target.value, page: 1 }))} />
          </div>
          {Array.isArray(results.households?.items) ? (
            <>
              <ul className="mt-2 space-y-2 text-xs">
                {results.households.items.map((h) => (
                  <li key={h.id} className="p-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{h.name}</div>
                        <div className="text-slate-400">Invite: {h.invite_code}</div>
                        <div className="text-slate-500 mt-0.5">Role: {h.yourRole || 'viewer'} • Members: {h.memberCount ?? '-'}</div>
                      </div>
                      <button className="btn-secondary !w-auto !px-2 !py-1 text-[11px]" onClick={() => openHousehold(h.id)}>Open</button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pager
                data={results.households}
                onPrev={() => {
                  const next = { ...householdsQuery, page: Math.max(1, householdsQuery.page - 1) };
                  setHouseholdsQuery(next);
                  loadHouseholds(next);
                }}
                onNext={() => {
                  const next = { ...householdsQuery, page: householdsQuery.page + 1 };
                  setHouseholdsQuery(next);
                  loadHouseholds(next);
                }}
              />
            </>
          ) : <EmptyState text="Create, join, or list households to see shared spaces." />}
          {activeHousehold && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-100">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Active Household: {activeHousehold.name}</p>
                <button className="text-slate-300 hover:text-white" onClick={() => {
                  setActiveHousehold(null);
                  setHouseholdWorkspace(null);
                }}>Close</button>
              </div>
              <p className="mt-1 text-emerald-200/90">Role: {activeHousehold.yourRole || 'viewer'} • Members: {activeHousehold.memberCount ?? '-'}</p>
              <p className="mt-1 text-emerald-200/90">Invite code: {activeHousehold.invite_code}</p>
              <p className="mt-1 text-emerald-200/90">Created: {activeHousehold.createdAt ? new Date(activeHousehold.createdAt).toLocaleString() : '—'}</p>

              {householdWorkspace?.members?.length > 0 && (
                <div className="mt-3 rounded-lg border border-emerald-500/20 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900/50 text-emerald-200">
                      <tr>
                        <th className="p-2 text-left">Member</th>
                        <th className="p-2 text-left">Role</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {householdWorkspace.members.map((m) => {
                        const canEdit = (activeHousehold?.yourRole === 'owner') && Number(m.isOwner) !== 1;
                        return (
                          <tr key={`${m.householdId}-${m.userId}`} className="border-t border-emerald-500/10">
                            <td className="p-2">
                              <div className="font-medium text-emerald-100">{m.username}</div>
                              {Number(m.isOwner) === 1 && <div className="text-[10px] text-emerald-300">Owner</div>}
                            </td>
                            <td className="p-2">
                              {canEdit ? (
                                <select
                                  className="input-glass !py-1"
                                  value={memberRoleDrafts[m.userId] || m.role}
                                  onChange={(e) => setMemberRoleDrafts((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                                >
                                  <option value="viewer">viewer</option>
                                  <option value="editor">editor</option>
                                </select>
                              ) : (
                                <span className="capitalize">{m.role}</span>
                              )}
                            </td>
                            <td className="p-2">
                              {canEdit ? (
                                <button
                                  className="btn-secondary !w-auto !py-1 !px-2 text-[11px]"
                                  disabled={Boolean(activeLoads['household-member-role'])}
                                  onClick={() => updateHouseholdMemberRole(activeHousehold.id, m.userId)}
                                >
                                  {activeLoads['household-member-role'] ? 'Saving…' : 'Save'}
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <ErrorState error={results.households?.error || results['household-create']?.error || results['household-join']?.error || results['household-access']?.error || results['household-members']?.error || results['household-member-role']?.error} />
        </ActionCard>

        <ActionCard title="9) Tax Workspace" subtitle="Category-based annual tax summary" icon={Receipt}>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => callApi('tax', `/api/next-level/tax/summary?year=${new Date().getFullYear()}`)}>Generate Tax Summary</button>
            <button className="btn-secondary" onClick={() => exportRows('tax-summary', results.tax?.categories || [], [
              { label: 'Category', value: (r) => r.category },
              { label: 'Total', value: (r) => r.total },
              { label: 'Likely Deductible', value: (r) => (r.likelyDeductible ? 'Yes' : 'No') },
            ])}><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          {Array.isArray(results.tax?.categories) ? (
            <div className="mt-3 overflow-auto rounded-xl border border-slate-700">
              <table className="w-full text-xs text-slate-300">
                <thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Deductible?</th></tr></thead>
                <tbody>
                  {results.tax.categories.map((c) => (
                    <tr key={c.category} className="border-t border-slate-800"><td className="p-2">{c.category}</td><td className="p-2 text-right">{money(c.total)}</td><td className="p-2 text-right">{c.likelyDeductible ? 'Yes' : 'No'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState text="Generate yearly tax summary to populate this table." />}
          <ErrorState error={results.tax?.error} />
        </ActionCard>

        <ActionCard title="Activity Timeline" subtitle="Server-backed audit trail across sessions/devices" icon={CalendarClock} status={getStatus('activity', 'activity-integrity')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <select
              className="input-glass"
              value={activityQuery.action}
              onChange={(e) => setActivityQuery((p) => ({ ...p, action: e.target.value, page: 1 }))}
            >
              <option value="">All actions</option>
              <option value="create">create</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
              <option value="join">join</option>
            </select>
            <select
              className="input-glass"
              value={activityQuery.entityType}
              onChange={(e) => setActivityQuery((p) => ({ ...p, entityType: e.target.value, page: 1 }))}
            >
              <option value="">All entities</option>
              <option value="networth">networth</option>
              <option value="rule">rule</option>
              <option value="bill">bill</option>
              <option value="household">household</option>
            </select>
            <input
              type="date"
              className="input-glass"
              value={activityQuery.from || ''}
              onChange={(e) => setActivityQuery((p) => ({ ...p, from: e.target.value, page: 1 }))}
            />
            <input
              type="date"
              className="input-glass"
              value={activityQuery.to || ''}
              onChange={(e) => setActivityQuery((p) => ({ ...p, to: e.target.value, page: 1 }))}
            />
            <button className="btn-primary" disabled={Boolean(activeLoads.activity)} onClick={() => loadActivityTimeline(activityQuery)}>
              {activeLoads.activity ? 'Loading…' : 'Load Timeline'}
            </button>
            <button
              className="btn-secondary"
              onClick={async () => {
                try {
                  await apiDownload(`/api/next-level/activity/export${qs(activityQuery)}`, {
                    token,
                    filename: `activity-timeline-${new Date().toISOString().slice(0, 10)}.csv`,
                  });
                  pushToast('success', 'Activity CSV exported.');
                } catch (err) {
                  pushToast('error', err.message || 'Failed to export activity CSV.');
                }
              }}
            >
              <Download size={14} className="inline mr-1" /> CSV
            </button>
            <button className="btn-secondary" onClick={async () => {
              try {
                const info = await loadActivityIntegrity();
                pushToast(info.valid ? 'success' : 'error', info.valid ? 'Activity chain integrity verified.' : 'Integrity check failed.');
              } catch (err) {
                pushToast('error', err.message || 'Integrity check failed.');
              }
            }}>
              Verify Integrity
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                const resetQuery = getDefaultActivityQuery();
                setActivityQuery(resetQuery);
                loadActivityTimeline(resetQuery);
              }}
            >
              Reset
            </button>
          </div>

          {activityIntegrity && (
            <div className={`mt-2 text-xs rounded-lg px-3 py-2 border ${activityIntegrity.valid ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : 'border-red-500/30 text-red-300 bg-red-500/5'}`}>
              Integrity: {activityIntegrity.valid ? 'VALID' : 'BROKEN'} • Entries: {activityIntegrity.count} • Latest hash: {(activityIntegrity.latestHash || 'N/A').slice(0, 16)}...
            </div>
          )}

          {Array.isArray(results.activity?.items) ? (
            <>
              <div className="mt-3 overflow-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs text-slate-300">
                  <thead className="bg-slate-900/70 text-slate-400">
                    <tr>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Action</th>
                      <th className="p-2 text-left">Entity</th>
                      <th className="p-2 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.activity.items.map((a) => (
                      <tr key={a.id} className="border-t border-slate-800">
                        <td className="p-2">{new Date(a.createdAt).toLocaleString()}</td>
                        <td className="p-2 uppercase">{a.action}</td>
                        <td className="p-2">{a.entityType} #{a.entityId ?? '-'}</td>
                        <td className="p-2 text-slate-400">
                          {a.payload?.before || a.payload?.after ? (
                            <span>
                              before→after: {Object.keys(a.payload?.after || {}).slice(0, 2).map((k) => `${k}:${a.payload?.before?.[k] ?? '-'}→${a.payload?.after?.[k] ?? '-'}`).join(' • ')}
                            </span>
                          ) : (
                            Object.entries(a.payload || {}).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(' • ') || '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                data={results.activity}
                onPrev={() => {
                  const next = { ...activityQuery, page: Math.max(1, activityQuery.page - 1) };
                  setActivityQuery(next);
                  loadActivityTimeline(next);
                }}
                onNext={() => {
                  const next = { ...activityQuery, page: activityQuery.page + 1 };
                  setActivityQuery(next);
                  loadActivityTimeline(next);
                }}
              />
            </>
          ) : (
            <EmptyState text="Load timeline to see your persisted audit history." />
          )}
          <ErrorState error={results.activity?.error} />
        </ActionCard>

        <ActionCard title="10) Smart Goal Optimizer" subtitle="Monthly contribution recommendations" icon={Target}>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => callApi('goals', '/api/next-level/goals/optimizer')}>Optimize Goals</button>
            <button className="btn-secondary" onClick={() => exportRows('goal-optimizer', results.goals?.recommendations || [], [
              { label: 'Name', value: (r) => r.name },
              { label: 'Remaining', value: (r) => r.remaining },
              { label: 'Months Left', value: (r) => r.monthsLeft },
              { label: 'Suggested Monthly Contribution', value: (r) => r.suggestedMonthlyContribution },
            ])}><Download size={14} className="inline mr-1" /> CSV</button>
          </div>
          {Array.isArray(results.goals?.recommendations) ? (
            <div className="mt-3 overflow-auto rounded-xl border border-slate-700">
              <table className="w-full text-xs text-slate-300">
                <thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-2 text-left">Goal</th><th className="p-2 text-right">Remaining</th><th className="p-2 text-right">Monthly Suggestion</th></tr></thead>
                <tbody>
                  {results.goals.recommendations.map((g) => (
                    <tr key={g.id} className="border-t border-slate-800"><td className="p-2">{g.name}</td><td className="p-2 text-right">{money(g.remaining)}</td><td className="p-2 text-right text-emerald-300">{money(g.suggestedMonthlyContribution)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState text="Run optimizer to view contribution recommendations." />}
          <ErrorState error={results.goals?.error} />
        </ActionCard>

        <ActionCard title="11) Executive Brief" subtitle="High-level strategic monthly snapshot" icon={Briefcase}>
          <button className="btn-primary" onClick={() => callApi('executive', '/api/next-level/executive/brief')}>Generate Brief</button>
          {results.executive?.highlights ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Net Worth</p><p className="text-white font-semibold">{money(results.executive.highlights.netWorth)}</p></div>
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Anomalies</p><p className="text-white font-semibold">{results.executive.highlights.anomalyCount}</p></div>
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Subs Found</p><p className="text-white font-semibold">{results.executive.highlights.potentialSubscriptions?.length || 0}</p></div>
            </div>
          ) : <EmptyState text="Generate executive brief for summary KPIs." />}
          <ErrorState error={results.executive?.error} />
        </ActionCard>

        <ActionCard title="12) Scenario Lab" subtitle="What-if planning and impact simulation" icon={Sparkles}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="input-glass" type="number" value={scenarioForm.monthlySavingsBoost} onChange={(e) => setScenarioForm((p) => ({ ...p, monthlySavingsBoost: Number(e.target.value || 0) }))} placeholder="Monthly boost" />
            <input className="input-glass" type="number" value={scenarioForm.expenseCutPct} onChange={(e) => setScenarioForm((p) => ({ ...p, expenseCutPct: Number(e.target.value || 0) }))} placeholder="Expense cut %" />
            <input className="input-glass" type="number" value={scenarioForm.months} onChange={(e) => setScenarioForm((p) => ({ ...p, months: Number(e.target.value || 1) }))} placeholder="Months" />
          </div>
          <button className="btn-primary mt-2" onClick={() => callApi('scenario', '/api/next-level/scenarios/evaluate', { method: 'POST', body: scenarioForm })}>Run Scenario</button>
          {results.scenario?.adjustedMonthlyNet !== undefined ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Base Net</p><p className="text-white font-semibold">{money(results.scenario.baseMonthlyNet)}</p></div>
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Adjusted Net</p><p className="text-emerald-300 font-semibold">{money(results.scenario.adjustedMonthlyNet)}</p></div>
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700"><p className="text-slate-400">Projected Gain</p><p className="text-emerald-300 font-semibold">{money(results.scenario.projectedGain)}</p></div>
            </div>
          ) : <EmptyState text="Run a scenario to see projected impact." />}
          <ErrorState error={results.scenario?.error} />
        </ActionCard>
      </div>
    </div>
  );
};

export default NextLevel;
