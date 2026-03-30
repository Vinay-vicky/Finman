import React, { useEffect, useMemo, useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';
import CalendarPicker from './CalendarPicker';
import RecurringManager from './RecurringManager';
import { Calendar, PlusCircle, Star, Clock3, ArrowRight, ShieldCheck, AlertTriangle, CalendarClock, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const calcMeta = {
  tvm: 'TVM Calculator',
  currency: 'Currency Converter',
  loan: 'Loan Calculator',
  compound: 'Compound Interest',
  ccPayoff: 'Credit Card Payoff',
  retirement: 'Retirement / 401K',
  tip: 'Tip Calculator',
  basic: 'Calculator',
  apr: 'APR Calculator',
  roi: 'ROI Calculator',
  autoLoan: 'Auto Loan Calculator',
  ccMinimum: 'Credit Card Minimum',
  discountTax: 'Discount & Tax',
  
  irrNpv: 'IRR / NPV Calculator',
  percentage: 'Percentage Calculator',
  bond: 'Bond Calculator',
  stock: 'Stock Calculator',
  misc: 'Misc Calculation',
};

const getLocalArray = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const Dashboard = ({ transactions, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onRefreshTransactions, dashboardInsights, onRefreshInsights }) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [animatedTotals, setAnimatedTotals] = useState({ balance: 0, income: 0, expense: 0 });

  useGSAP(() => {
    gsap.from('.dashboard-item', {
      y: 40,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out',
      clearProps: 'all' // prevents conflict with hover transforms
    });
  }, { scope: containerRef });

  useEffect(() => {
    const tiles = containerRef.current?.querySelectorAll('.tilt-card') || [];
    const cleanups = [];

    tiles.forEach((tile) => {
      const animateTile = (clientX, clientY) => {
        const rect = tile.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) - 0.5;
        const y = ((clientY - rect.top) / rect.height) - 0.5;

        gsap.to(tile, {
          rotateY: x * 5,
          rotateX: y * -5,
          y: -3,
          duration: 0.22,
          ease: 'power2.out',
          transformPerspective: 800,
          transformOrigin: 'center',
        });
      };

      const onMove = (event) => {
        animateTile(event.clientX, event.clientY);
      };

      const onTouchStart = (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        animateTile(touch.clientX, touch.clientY);
      };

      const onTouchMove = (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        animateTile(touch.clientX, touch.clientY);
      };

      const onLeave = () => {
        gsap.to(tile, {
          rotateY: 0,
          rotateX: 0,
          y: 0,
          duration: 0.35,
          ease: 'power2.out',
        });
      };

      tile.addEventListener('mousemove', onMove);
      tile.addEventListener('mouseleave', onLeave);
      tile.addEventListener('touchstart', onTouchStart, { passive: true });
      tile.addEventListener('touchmove', onTouchMove, { passive: true });
      tile.addEventListener('touchend', onLeave);
      cleanups.push(() => {
        tile.removeEventListener('mousemove', onMove);
        tile.removeEventListener('mouseleave', onLeave);
        tile.removeEventListener('touchstart', onTouchStart);
        tile.removeEventListener('touchmove', onTouchMove);
        tile.removeEventListener('touchend', onLeave);
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filterMode, setFilterMode] = useState('date'); // 'date', 'week', 'month', 'year', 'all'
  const [favoriteCalcIds, setFavoriteCalcIds] = useState(() => getLocalArray('finman.calcFavorites'));
  const [recentCalcIds, setRecentCalcIds] = useState(() => getLocalArray('finman.calcRecent'));

  useEffect(() => {
    const syncCalcShortcuts = () => {
      setFavoriteCalcIds(getLocalArray('finman.calcFavorites'));
      setRecentCalcIds(getLocalArray('finman.calcRecent'));
    };

    syncCalcShortcuts();
    window.addEventListener('focus', syncCalcShortcuts);
    window.addEventListener('storage', syncCalcShortcuts);

    return () => {
      window.removeEventListener('focus', syncCalcShortcuts);
      window.removeEventListener('storage', syncCalcShortcuts);
    };
  }, []);

  const favoriteCalcChips = useMemo(
    () => favoriteCalcIds.map((id) => ({ id, label: calcMeta[id] || id })).slice(0, 6),
    [favoriteCalcIds]
  );

  const recentCalcChips = useMemo(
    () => recentCalcIds.map((id) => ({ id, label: calcMeta[id] || id })).slice(0, 6),
    [recentCalcIds]
  );

  const openCalculator = (id) => {
    navigate(`/calculators?tool=${encodeURIComponent(id)}`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const now = new Date();
  
  // Filter logic based on selected date and mode
  const filteredTransactions = transactions.filter(t => {
    let txDate = new Date(t.date);
    if (isNaN(txDate.getTime())) txDate = new Date();
    
    if (filterMode === 'date') {
      return txDate.toDateString() === selectedDate.toDateString();
    }
    
    if (filterMode === 'week') {
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return txDate >= startOfWeek && txDate <= endOfWeek;
    }
    
    if (filterMode === 'month') {
      return txDate.getMonth() === selectedDate.getMonth() && txDate.getFullYear() === selectedDate.getFullYear();
    }

    if (filterMode === 'year') {
      return txDate.getFullYear() === selectedDate.getFullYear();
    }
    
    if (filterMode === 'all') return true;
    
    return true;
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
    
  const balance = totalIncome - totalExpense;

  useEffect(() => {
    const tweenState = {
      balance: animatedTotals.balance,
      income: animatedTotals.income,
      expense: animatedTotals.expense,
    };

    const tween = gsap.to(tweenState, {
      balance,
      income: totalIncome,
      expense: totalExpense,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        setAnimatedTotals({
          balance: tweenState.balance,
          income: tweenState.income,
          expense: tweenState.expense,
        });
      },
    });

    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, totalIncome, totalExpense]);

  const handleUpdate = async (updatedTransaction) => {
    try {
      await onUpdateTransaction(updatedTransaction);
      setEditingTransaction(null);
    } catch (err) {
      console.error('Failed to update transaction:', err);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const jumpToQuickAdd = () => {
    const formEl = document.getElementById('quick-add-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formattedDateDisplay = selectedDate.toLocaleString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const insightsUpdatedLabel = dashboardInsights?.lastUpdated
    ? new Date(dashboardInsights.lastUpdated).toLocaleTimeString()
    : '—';

  const topAnomalies = Array.isArray(dashboardInsights?.topAnomalies) ? dashboardInsights.topAnomalies : [];
  const weeklyBrief = dashboardInsights?.weeklyBrief;

  const exportWeeklyBrief = () => {
    if (!weeklyBrief) return;
    const lines = [
      'FinMan Weekly CFO Brief',
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      '',
      `Headline: ${weeklyBrief.headline || 'N/A'}`,
      `Summary: ${weeklyBrief.summary || 'N/A'}`,
      `Risk Level: ${weeklyBrief.riskLevel || 'N/A'}`,
      `Cashflow Trend: ${weeklyBrief.cashflowTrend || 'N/A'}`,
      `Top Category: ${weeklyBrief.topCategory || 'N/A'}`,
      `Action Item: ${weeklyBrief.actionItem || 'N/A'}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-cfo-brief-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const createApprovalDraft = (anomaly) => {
    const payload = {
      amount: Number(anomaly?.amount || 0),
      title: anomaly?.title || 'Flagged Expense',
      category: anomaly?.category || 'General',
      note: `Raised from Dashboard anomaly signal (${new Date().toLocaleString('en-IN')}).`,
      householdId: dashboardInsights?.defaultHouseholdId || null,
      householdName: dashboardInsights?.defaultHouseholdName || null,
    };

    try {
      window.localStorage.setItem('finman_nextlevel_approval_draft', JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
    navigate('/next-level');
  };

  return (
    <div className="flex flex-col gap-6" ref={containerRef}>
      
      {/* Header and Calendar Picker */}
      <div className="dashboard-item glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-600/50 transition-colors">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Financial Overview</h2>
          <p className="text-slate-400 text-sm mt-1">Track your spending and income</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date Display */}
          <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
            <span className="text-sm text-slate-300 font-medium">{formattedDateDisplay}</span>
          </div>

          {/* Calendar Button */}
          <button 
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 rounded-lg transition-all font-medium shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transform hover:-translate-y-0.5"
          >
            <Calendar size={18} />
            Pick Date & Time
          </button>

          {/* Filter Mode Toggle */}
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
            {[
              { mode: 'date', label: 'Day' },
              { mode: 'week', label: 'Week' },
              { mode: 'month', label: 'Month' },
              { mode: 'year', label: 'Year' },
              { mode: 'all', label: 'All' }
            ].map(({ mode, label }) => (
              <button 
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                  filterMode === mode 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <CalendarPicker 
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Calculator Shortcuts */}
      <div className="dashboard-item glass-panel p-5 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Quick Calculator Shortcuts</h3>
            <p className="text-xs text-slate-400 mt-0.5">Jump directly to your most-used tools.</p>
          </div>
          <button
            onClick={() => navigate('/calculators')}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1"
          >
            Open Center <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <p className="text-xs text-slate-300 flex items-center gap-1 mb-2"><Star size={12} className="text-amber-300" /> Pinned Favorites</p>
            {favoriteCalcChips.length === 0 ? (
              <p className="text-xs text-slate-500">Pin calculators in the Calculators Center to see them here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {favoriteCalcChips.map((c) => (
                  <button
                    key={`fav-${c.id}`}
                    onClick={() => openCalculator(c.id)}
                    className="px-2.5 py-1.5 rounded-full text-xs border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                    title={c.label}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <p className="text-xs text-slate-300 flex items-center gap-1 mb-2"><Clock3 size={12} className="text-cyan-300" /> Recently Used</p>
            {recentCalcChips.length === 0 ? (
              <p className="text-xs text-slate-500">Open calculators to build your recent list.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentCalcChips.map((c) => (
                  <button
                    key={`recent-${c.id}`}
                    onClick={() => openCalculator(c.id)}
                    className="px-2.5 py-1.5 rounded-full text-xs border border-slate-600/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/70"
                    title={c.label}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Balance Cards with 3D Effect */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance Card */}
        <div className="dashboard-item tilt-card glass-panel p-6 relative overflow-hidden group rounded-2xl transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/30">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Balance</p>
          <p className={`text-4xl font-extrabold ${balance >= 0 ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.2)]'}`}>
            {formatCurrency(animatedTotals.balance)}
          </p>
        </div>

        {/* Total Income Card */}
        <div className="dashboard-item tilt-card glass-panel p-6 relative overflow-hidden group rounded-2xl transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 text-emerald-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.8l7.5 15H4.5L12 5.8z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Income</p>
          <p className="text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
            {formatCurrency(animatedTotals.income)}
          </p>
        </div>

        {/* Total Expense Card */}
        <div className="dashboard-item tilt-card glass-panel p-6 relative overflow-hidden group rounded-2xl transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-900/20">
          <div className="absolute inset-0 bg-gradient-to-br from-red-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 text-red-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22L2 2h20L12 22zm0-3.8l7.5-15H4.5L12 18.2z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Expense</p>
          <p className="text-4xl font-extrabold text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.4)]">
            {formatCurrency(animatedTotals.expense)}
          </p>
        </div>
      </div>

      <div className="dashboard-item glass-panel p-5 rounded-2xl border border-cyan-500/20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Integrated Intelligence</h3>
            <p className="text-xs text-slate-400 mt-0.5">Live signals from Next-Level APIs inside your main dashboard.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshInsights}
              disabled={Boolean(dashboardInsights?.loading)}
              className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-700/80 disabled:opacity-60"
            >
              {dashboardInsights?.loading ? 'Refreshing…' : 'Refresh Signals'}
            </button>
            <button
              onClick={() => navigate('/next-level')}
              className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold flex items-center gap-1"
            >
              Open Next-Level <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-emerald-200 flex items-center gap-1 mb-1"><ShieldCheck size={12} /> Health Score</p>
            <p className="text-2xl font-extrabold text-emerald-300">{dashboardInsights?.healthScore ?? '—'}</p>
            <p className="text-[11px] text-emerald-200/80">/100 financial fitness</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-200 flex items-center gap-1 mb-1"><AlertTriangle size={12} /> Spending Anomalies</p>
            <p className="text-2xl font-extrabold text-amber-300">{Number(dashboardInsights?.anomalyCount || 0)}</p>
            <p className="text-[11px] text-amber-200/80">flagged in latest detection</p>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
            <p className="text-xs text-cyan-200 flex items-center gap-1 mb-1"><CalendarClock size={12} /> Upcoming Bills (14d)</p>
            <p className="text-2xl font-extrabold text-cyan-300">{Number(dashboardInsights?.upcomingBillsCount || 0)}</p>
            <p className="text-[11px] text-cyan-200/80">₹{Number(dashboardInsights?.upcomingBillsAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} due</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs text-amber-200 font-semibold">Top anomaly actions</p>
              <button className="text-[11px] text-amber-200 hover:text-white" onClick={() => navigate('/next-level')}>View all</button>
            </div>
            {topAnomalies.length === 0 ? (
              <p className="text-xs text-slate-400">No flagged anomalies in the latest scan.</p>
            ) : (
              <div className="space-y-2">
                {topAnomalies.map((item, idx) => (
                  <div key={`${item.id || item.title}-${idx}`} className="rounded-lg border border-amber-500/20 bg-slate-900/50 px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-100 font-medium truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-400">{item.category || 'General'} • ₹{Number(item.amount || 0).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-cyan-200/80">Target household: {dashboardInsights?.defaultHouseholdName || 'Select in Next-Level'}</p>
                      </div>
                      <button
                        className="px-2 py-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 text-[11px] hover:bg-cyan-500/25"
                        onClick={() => createApprovalDraft(item)}
                      >
                        Approval Draft
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs text-violet-200 font-semibold">Weekly CFO brief</p>
              <button
                className="px-2 py-1 rounded-md border border-violet-500/40 bg-violet-500/15 text-violet-200 text-[11px] hover:bg-violet-500/25 flex items-center gap-1"
                onClick={exportWeeklyBrief}
                disabled={!weeklyBrief}
              >
                <Download size={12} /> Export
              </button>
            </div>
            {weeklyBrief ? (
              <>
                <p className="text-sm text-white font-semibold">{weeklyBrief.headline || 'Weekly snapshot ready'}</p>
                <p className="text-xs text-slate-300 mt-1">{weeklyBrief.summary || 'No summary available.'}</p>
                <p className="text-[11px] text-violet-200 mt-2">Action: {weeklyBrief.actionItem || 'Review anomalies and tighten recurring spends.'}</p>
              </>
            ) : (
              <p className="text-xs text-slate-400">Weekly brief will appear after insight refresh.</p>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>Last updated: {insightsUpdatedLabel}</span>
          {dashboardInsights?.error ? <span className="text-red-300">{dashboardInsights.error}</span> : <span className="text-slate-500">Signals auto-refresh every 3 minutes.</span>}
        </div>
      </div>

      {/* Main Grid: Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <div className="dashboard-item">
          <div id="quick-add-form" className="sticky top-6">
            <TransactionForm 
              onAdd={onAddTransaction}
              onUpdate={handleUpdate}
              editingTransaction={editingTransaction}
              onCancelEdit={() => setEditingTransaction(null)}
              selectedDate={filterMode === 'date' ? selectedDate : null}
            />
          </div>
          <RecurringManager onRefreshTransactions={onRefreshTransactions} />
        </div>
        <div className="dashboard-item glass-panel p-6 rounded-2xl">
          <TransactionList 
            transactions={filteredTransactions} 
            onDelete={onDeleteTransaction}
            onEdit={setEditingTransaction}
          />
        </div>
      </div>

      <button
        onClick={jumpToQuickAdd}
        className="md:hidden fixed bottom-20 right-4 z-40 px-4 py-3 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 flex items-center gap-2 font-semibold"
      >
        <PlusCircle size={18} /> Quick Add
      </button>
    </div>
  );
};

export default Dashboard;
