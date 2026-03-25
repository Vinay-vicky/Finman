import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Calculator,
  Landmark,
  Wallet,
  TrendingUp,
  Percent,
  BadgeDollarSign,
  Car,
  Receipt,
  PiggyBank,
  CircleDollarSign,
  BarChart3,
  Mail,
  Save,
  History,
  FileText,
  Table,
  RotateCcw,
  Search,
  Star,
  Clock3,
} from 'lucide-react';

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const formatCurrency = (value, decimals = 2) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
const formatPercent = (value, decimals = 2) => `${Number(value || 0).toFixed(decimals)}%`;

const calcTypes = [
  { id: 'tvm', label: 'TVM Calculator', icon: CircleDollarSign },
  { id: 'currency', label: 'Currency Converter', icon: BadgeDollarSign },
  { id: 'loan', label: 'Loan Calculator', icon: Landmark },
  { id: 'compound', label: 'Compound Interest', icon: TrendingUp },
  { id: 'ccPayoff', label: 'Credit Card Payoff', icon: Wallet },
  { id: 'retirement', label: 'Retirement / 401K', icon: PiggyBank },
  { id: 'tip', label: 'Tip Calculator', icon: Receipt },
  { id: 'basic', label: 'Calculator', icon: Calculator },
  { id: 'apr', label: 'APR Calculator', icon: Percent },
  { id: 'roi', label: 'ROI Calculator', icon: BarChart3 },
  { id: 'autoLoan', label: 'Auto Loan Calculator', icon: Car },
  { id: 'ccMinimum', label: 'Credit Card Minimum', icon: Wallet },
  { id: 'discountTax', label: 'Discount & Tax', icon: Percent },
  { id: 'irrNpv', label: 'IRR / NPV Calculator', icon: TrendingUp },
  { id: 'percentage', label: 'Percentage Calculator', icon: Percent },
  { id: 'bond', label: 'Bond Calculator', icon: Landmark },
  { id: 'stock', label: 'Stock Calculator', icon: TrendingUp },
  { id: 'misc', label: 'Misc Calculation', icon: Calculator },
];

const retirementTools = [
  'Retirement Planner',
  '401k Contribution Calculator',
  'Retirement Savings Analysis',
  'Retirement Income Analysis',
  'Traditional IRA vs Roth IRA',
  'Required Minimum Distribution',
  'Social Security Estimator',
  'Asset Allocation Calculator',
];

const stockTools = [
  'Stock Return Calculator',
  'Constant Growth Stock',
  'Non-constant Growth Stock',
  'CAPM Calculator',
  'Expected Return Calculator',
  'Holding Period Return Calculator',
  'WACC Calculator',
  'Black-Scholes Option Calculator',
];

const miscTools = [
  'Unit Converter',
  'Date Calculation',
  'Loan Analysis',
  'Rule of 78 Loan Calculator',
  'Commercial Loan Calculator',
  'Rule of 72 Calculator',
  'Tax Equivalent Yield Calculator',
  'Inflation Calculator',
];

const colorBars = ['bg-emerald-300', 'bg-slate-400', 'bg-lime-400', 'bg-amber-400', 'bg-red-500', 'bg-cyan-400', 'bg-rose-700', 'bg-fuchsia-500'];
const actionBtnBase = 'px-3 py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-1 min-h-[42px]';

const tvmCompoundingMap = {
  Annually: 1,
  Semiannual: 2,
  Quarterly: 4,
  Monthly: 12,
  Weekly: 52,
  Daily: 365,
};

const Field = ({ label, value, onChange, type = 'number', placeholder }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs text-slate-400">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
    />
  </label>
);

const Result = ({ label, value, tone = 'text-emerald-300' }) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
    <p className="text-xs text-slate-400">{label}</p>
    <p className={`text-lg font-bold ${tone}`}>{value}</p>
  </div>
);

const ListPanel = ({ title, items }) => (
  <div className="rounded-xl border border-slate-700/50 overflow-hidden">
    <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-700/50">
      <p className="text-sm font-semibold text-white">{title}</p>
    </div>
    {items.map((item, idx) => (
      <div key={item} className={`flex items-stretch ${idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/30'}`}>
        <span className={`w-1.5 ${colorBars[idx % colorBars.length]}`} />
        <p className="px-3 py-2 text-sm text-slate-100">{item}</p>
      </div>
    ))}
  </div>
);

const getLocalHistory = () => {
  try {
    const raw = localStorage.getItem('finman.tvmHistory');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistLocalHistory = (history) => {
  try {
    localStorage.setItem('finman.tvmHistory', JSON.stringify(history.slice(0, 20)));
  } catch {
    // ignore storage failures
  }
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

const persistLocalArray = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const ActionButton = ({ children, className = '', ...props }) => (
  <button {...props} className={`${actionBtnBase} ${className}`}>{children}</button>
);

const createCsvAndDownload = (filename, headers, rows) => {
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const Calculators = () => {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('tvm');
  const [recentCalcIds, setRecentCalcIds] = useState(() => getLocalArray('finman.calcRecent'));
  const [favoriteCalcIds, setFavoriteCalcIds] = useState(() => getLocalArray('finman.calcFavorites'));
  const [dragFavoriteId, setDragFavoriteId] = useState(null);
  const [mobileReorderMode, setMobileReorderMode] = useState(false);
  const [mobilePickFavoriteId, setMobilePickFavoriteId] = useState(null);
  const longPressTimerRef = useRef(null);

  const [tvmPv, setTvmPv] = useState('200000');
  const [tvmPmt, setTvmPmt] = useState('1500');
  const [tvmFv, setTvmFv] = useState('0');
  const [tvmRate, setTvmRate] = useState('6');
  const [tvmPeriods, setTvmPeriods] = useState('240');
  const [tvmCompounding, setTvmCompounding] = useState('Monthly');
  const [tvmMode, setTvmMode] = useState('end');
  const [tvmDecimals, setTvmDecimals] = useState(2);
  const [tvmSolveFor, setTvmSolveFor] = useState('fv');
  const [tvmHistory, setTvmHistory] = useState(() => getLocalHistory());
  const [tvmMessage, setTvmMessage] = useState('');

  const [currAmount, setCurrAmount] = useState('100');
  const [currRate, setCurrRate] = useState('83.2');

  const [loanPrincipal, setLoanPrincipal] = useState('150000');
  const [loanRate, setLoanRate] = useState('3.125');
  const [loanYears, setLoanYears] = useState('15');
  const [loanMonthsExtra, setLoanMonthsExtra] = useState('0');
  const [loanExtraPayment, setLoanExtraPayment] = useState('100');
  const [loanShowAmortization, setLoanShowAmortization] = useState(false);

  const [compPrincipal, setCompPrincipal] = useState('10000');
  const [compMonthlyDeposit, setCompMonthlyDeposit] = useState('1000');
  const [compPeriodMonths, setCompPeriodMonths] = useState('12');
  const [compRate, setCompRate] = useState('2.125');
  const [compounding, setCompounding] = useState('Monthly');
  const [compoundShowTable, setCompoundShowTable] = useState(false);

  const [ccBalance, setCcBalance] = useState('120000');
  const [ccApr, setCcApr] = useState('36');
  const [ccPayment, setCcPayment] = useState('6000');

  const [retCurrent, setRetCurrent] = useState('200000');
  const [retMonthly, setRetMonthly] = useState('10000');
  const [retRate, setRetRate] = useState('10');
  const [retYears, setRetYears] = useState('20');

  const [tipBill, setTipBill] = useState('2500');
  const [tipPct, setTipPct] = useState('10');
  const [tipPeople, setTipPeople] = useState('2');

  const [basicA, setBasicA] = useState('12');
  const [basicB, setBasicB] = useState('3');
  const [basicOp, setBasicOp] = useState('+');

  const [aprPrincipal, setAprPrincipal] = useState('300000');
  const [aprFee, setAprFee] = useState('5000');
  const [aprMonths, setAprMonths] = useState('36');
  const [aprPmt, setAprPmt] = useState('10500');

  const [roiCost, setRoiCost] = useState('100000');
  const [roiValue, setRoiValue] = useState('130000');

  const [autoPrice, setAutoPrice] = useState('900000');
  const [autoDown, setAutoDown] = useState('100000');
  const [autoTrade, setAutoTrade] = useState('0');
  const [autoRate, setAutoRate] = useState('9.5');
  const [autoMonths, setAutoMonths] = useState('60');

  const [ccMinBalance, setCcMinBalance] = useState('50000');
  const [ccMinRate, setCcMinRate] = useState('5');
  const [ccMinFixed, setCcMinFixed] = useState('500');

  const [discPrice, setDiscPrice] = useState('2500');
  const [discPct, setDiscPct] = useState('20');
  const [taxPct, setTaxPct] = useState('18');

  const [npvInitial, setNpvInitial] = useState('100000');
  const [npvRate, setNpvRate] = useState('12');
  const [npvCashflows, setNpvCashflows] = useState('30000,35000,40000,45000');

  const [percX, setPercX] = useState('25');
  const [percY, setPercY] = useState('200');
  const [percChangeBase, setPercChangeBase] = useState('1000');
  const [percChangePct, setPercChangePct] = useState('15');

  const [bondFace, setBondFace] = useState('1000');
  const [bondCoupon, setBondCoupon] = useState('7');
  const [bondYield, setBondYield] = useState('8');
  const [bondYears, setBondYears] = useState('10');

  const [stockShares, setStockShares] = useState('100');
  const [stockBuy, setStockBuy] = useState('150');
  const [stockGrowth, setStockGrowth] = useState('12');
  const [stockYears, setStockYears] = useState('5');

  const [miscFixed, setMiscFixed] = useState('100000');
  const [miscPrice, setMiscPrice] = useState('1200');
  const [miscVariable, setMiscVariable] = useState('700');

  const filtered = useMemo(
    () => calcTypes.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  useEffect(() => {
    setRecentCalcIds((prev) => {
      const next = [active, ...prev.filter((id) => id !== active)].slice(0, 8);
      persistLocalArray('finman.calcRecent', next);
      return next;
    });
  }, [active]);

  useEffect(() => {
    persistLocalArray('finman.calcFavorites', favoriteCalcIds);
  }, [favoriteCalcIds]);

  const toggleFavorite = (id) => {
    setFavoriteCalcIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 12)
    ));
  };

  const reorderFavorites = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;

    setFavoriteCalcIds((prev) => {
      const fromIndex = prev.indexOf(fromId);
      const toIndex = prev.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleFavoriteTouchStart = (id) => {
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setMobileReorderMode(true);
      setMobilePickFavoriteId(id);
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        window.navigator.vibrate(15);
      }
    }, 450);
  };

  const handleFavoriteTouchEnd = () => {
    clearLongPressTimer();
  };

  const handlePinnedFavoriteClick = (id) => {
    if (!mobileReorderMode) {
      setActive(id);
      return;
    }

    if (!mobilePickFavoriteId) {
      setMobilePickFavoriteId(id);
      return;
    }

    reorderFavorites(mobilePickFavoriteId, id);
    setMobilePickFavoriteId(id);
  };

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  const recentCalculators = recentCalcIds
    .map((id) => calcTypes.find((c) => c.id === id))
    .filter(Boolean);

  const displayedCalculators = useMemo(() => {
    const favorites = favoriteCalcIds
      .map((id) => filtered.find((c) => c.id === id))
      .filter(Boolean);
    const others = filtered.filter((c) => !favoriteCalcIds.includes(c.id));
    return [...favorites, ...others];
  }, [filtered, favoriteCalcIds]);

  const pinnedFavoriteCalculators = useMemo(
    () => favoriteCalcIds
      .map((id) => calcTypes.find((c) => c.id === id))
      .filter(Boolean),
    [favoriteCalcIds]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const tool = params.get('tool');
    if (tool && calcTypes.some((c) => c.id === tool)) {
      setActive(tool);
    }
  }, [location.search]);

  const tvmPeriodsNum = Math.max(1, toNum(tvmPeriods));
  const tvmRatePerPeriod = (toNum(tvmRate) / 100) / tvmCompoundingMap[tvmCompounding];
  const tvmPmtTimingFactor = tvmMode === 'beginning' ? (1 + tvmRatePerPeriod) : 1;

  const solveTVM = () => {
    const n = Math.max(1, toNum(tvmPeriods));
    const pv = toNum(tvmPv);
    const pmt = toNum(tvmPmt);
    const fv = toNum(tvmFv);
    let r = (toNum(tvmRate) / 100) / tvmCompoundingMap[tvmCompounding];
    const timing = tvmMode === 'beginning' ? 1 : 0;

    const pmtFactor = (rate, periods) => {
      if (Math.abs(rate) < 1e-10) return periods;
      return (((1 + rate) ** periods) - 1) / rate;
    };

    if (tvmSolveFor === 'fv') {
      const result = pv * ((1 + r) ** n) + pmt * pmtFactor(r, n) * (timing ? (1 + r) : 1);
      setTvmFv(String(result));
    }

    if (tvmSolveFor === 'pv') {
      const denom = (1 + r) ** n;
      const result = (fv - pmt * pmtFactor(r, n) * (timing ? (1 + r) : 1)) / denom;
      setTvmPv(String(result));
    }

    if (tvmSolveFor === 'pmt') {
      const factor = pmtFactor(r, n) * (timing ? (1 + r) : 1);
      const result = factor === 0 ? 0 : (fv - pv * ((1 + r) ** n)) / factor;
      setTvmPmt(String(result));
    }

    if (tvmSolveFor === 'rate') {
      let lo = -0.9999;
      let hi = 2;
      const target = fv;
      const f = (rate) => pv * ((1 + rate) ** n) + pmt * pmtFactor(rate, n) * (timing ? (1 + rate) : 1) - target;
      for (let i = 0; i < 90; i += 1) {
        const mid = (lo + hi) / 2;
        const val = f(mid);
        if (val > 0) hi = mid;
        else lo = mid;
      }
      const periodRate = (lo + hi) / 2;
      const annual = periodRate * tvmCompoundingMap[tvmCompounding] * 100;
      setTvmRate(String(annual));
      r = periodRate;
    }

    if (tvmSolveFor === 'period') {
      const A = pv;
      const B = pmt * (timing ? (1 + r) : 1);
      if (Math.abs(r) < 1e-12) {
        const res = (fv - pv) / (pmt || 1);
        setTvmPeriods(String(Math.max(1, res)));
      } else {
        const val = (fv + B / r) / (A + B / r);
        const res = Math.log(Math.max(val, 1e-12)) / Math.log(1 + r);
        setTvmPeriods(String(Math.max(1, res)));
      }
    }

    setTvmMessage(`Calculated ${tvmSolveFor.toUpperCase()} successfully.`);
  };

  const tvmComputedFv = toNum(tvmPv) * ((1 + tvmRatePerPeriod) ** tvmPeriodsNum) + toNum(tvmPmt) * ((((1 + tvmRatePerPeriod) ** tvmPeriodsNum) - 1) / (tvmRatePerPeriod || 1)) * tvmPmtTimingFactor;

  const saveTvmScenario = () => {
    const entry = {
      at: new Date().toISOString(),
      pv: toNum(tvmPv),
      pmt: toNum(tvmPmt),
      fv: toNum(tvmFv || tvmComputedFv),
      rate: toNum(tvmRate),
      periods: toNum(tvmPeriods),
      compounding: tvmCompounding,
      mode: tvmMode,
      solveFor: tvmSolveFor,
    };
    const next = [entry, ...tvmHistory].slice(0, 20);
    setTvmHistory(next);
    persistLocalHistory(next);
    setTvmMessage('Saved to history.');
  };

  const loadTvmExample = () => {
    setTvmPv('200000');
    setTvmPmt('1432.86');
    setTvmFv('0');
    setTvmRate('6');
    setTvmPeriods('240');
    setTvmCompounding('Monthly');
    setTvmMode('end');
    setTvmSolveFor('fv');
    setTvmMessage('Example loaded.');
  };

  const resetTvm = () => {
    setTvmPv('0');
    setTvmPmt('0');
    setTvmFv('0');
    setTvmRate('0');
    setTvmPeriods('1');
    setTvmCompounding('Monthly');
    setTvmMode('end');
    setTvmSolveFor('fv');
    setTvmDecimals(2);
    setTvmMessage('TVM reset.');
  };

  const emailTvmSummary = async () => {
    const body = `TVM Summary%0D%0A` +
      `PV: ${tvmPv}%0D%0APMT: ${tvmPmt}%0D%0AFV: ${toNum(tvmFv || tvmComputedFv).toFixed(tvmDecimals)}%0D%0A` +
      `Rate: ${tvmRate}%0D%0APeriods: ${tvmPeriods}%0D%0ACompounding: ${tvmCompounding}%0D%0AMode: ${tvmMode}`;
    window.location.href = `mailto:?subject=FinMan TVM Report&body=${body}`;
  };

  const currencyOut = toNum(currAmount) * toNum(currRate);

  const loanTotalMonths = Math.max(1, (toNum(loanYears) * 12) + toNum(loanMonthsExtra));
  const monthlyRate = (toNum(loanRate) / 100) / 12;
  const loanEmi = monthlyRate === 0
    ? toNum(loanPrincipal) / loanTotalMonths
    : (toNum(loanPrincipal) * monthlyRate * ((1 + monthlyRate) ** loanTotalMonths)) / (((1 + monthlyRate) ** loanTotalMonths) - 1);

  const buildAmortization = (principal, rateMonthly, payment, extraPayment = 0) => {
    const rows = [];
    let balance = principal;
    let month = 0;
    let totalInterest = 0;
    const guard = 1200;

    while (balance > 0.01 && month < guard) {
      month += 1;
      const interest = balance * rateMonthly;
      const principalPaid = Math.min(balance, Math.max(0, payment - interest) + Math.max(0, extraPayment));
      const actualPayment = principalPaid + interest;
      balance = Math.max(0, balance - principalPaid);
      totalInterest += interest;
      rows.push({ month, payment: actualPayment, interest, principal: principalPaid, balance });
      if (payment <= interest && extraPayment <= 0) break;
    }

    return { rows, totalInterest, months: month, totalPayment: rows.reduce((s, r) => s + r.payment, 0) };
  };

  const baseSchedule = buildAmortization(toNum(loanPrincipal), monthlyRate, loanEmi, 0);
  const extraSchedule = buildAmortization(toNum(loanPrincipal), monthlyRate, loanEmi, toNum(loanExtraPayment));

  const loanInterestSaving = baseSchedule.totalInterest - extraSchedule.totalInterest;
  const payoffEarlierMonths = baseSchedule.months - extraSchedule.months;
  const annualPayment = loanEmi * 12;
  const mortgageConstant = toNum(loanPrincipal) === 0 ? 0 : (annualPayment / toNum(loanPrincipal)) * 100;

  const emailLoanSummary = () => {
    const body = `Loan Summary%0D%0A` +
      `Amount: ${loanPrincipal}%0D%0ARate: ${loanRate}%0D%0ATerm months: ${loanTotalMonths}%0D%0A` +
      `Monthly Payment: ${loanEmi.toFixed(2)}%0D%0ATotal Interest: ${baseSchedule.totalInterest.toFixed(2)}%0D%0A` +
      `Extra Payment: ${loanExtraPayment}%0D%0AInterest Saving: ${loanInterestSaving.toFixed(2)}%0D%0APayoff Earlier: ${payoffEarlierMonths} months`;
    window.location.href = `mailto:?subject=FinMan Loan Report&body=${body}`;
  };

  const exportLoanAmortization = () => {
    createCsvAndDownload(
      'loan-amortization.csv',
      ['Month', 'Payment', 'Interest', 'Principal', 'Balance'],
      extraSchedule.rows.map((r) => [r.month, r.payment.toFixed(2), r.interest.toFixed(2), r.principal.toFixed(2), r.balance.toFixed(2)])
    );
  };

  const compM = tvmCompoundingMap[compounding];
  const compRateMonthlyEquivalent = ((1 + (toNum(compRate) / 100) / compM) ** (compM / 12)) - 1;
  const compMonths = Math.max(1, toNum(compPeriodMonths));
  let compBalance = toNum(compPrincipal);
  const compoundTable = [];

  for (let i = 1; i <= compMonths; i += 1) {
    compBalance = (compBalance * (1 + compRateMonthlyEquivalent)) + toNum(compMonthlyDeposit);
    compoundTable.push({ month: i, balance: compBalance });
  }

  const compTotalPrincipal = toNum(compPrincipal) + (toNum(compMonthlyDeposit) * compMonths);
  const compMaturityValue = compBalance;
  const compInterestAmount = compMaturityValue - compTotalPrincipal;
  const compApy = (((1 + (toNum(compRate) / 100) / compM) ** compM) - 1) * 100;

  const emailCompoundSummary = () => {
    const body = `Compound Interest Summary%0D%0A` +
      `Principal: ${compPrincipal}%0D%0AMonthly Deposit: ${compMonthlyDeposit}%0D%0APeriod Months: ${compPeriodMonths}%0D%0A` +
      `Rate: ${compRate}%0D%0ACompounding: ${compounding}%0D%0A` +
      `Maturity Value: ${compMaturityValue.toFixed(2)}%0D%0AInterest: ${compInterestAmount.toFixed(2)}%0D%0AAPY: ${compApy.toFixed(4)}%`;
    window.location.href = `mailto:?subject=FinMan Compound Report&body=${body}`;
  };

  const exportCompoundTable = () => {
    createCsvAndDownload(
      'compound-growth-table.csv',
      ['Month', 'Balance'],
      compoundTable.map((r) => [r.month, r.balance.toFixed(2)])
    );
  };

  const ccMonthlyRate = (toNum(ccApr) / 100) / 12;
  const ccMonths = ccPayment <= 0 || ccMonthlyRate <= 0 || (ccMonthlyRate * toNum(ccBalance)) >= toNum(ccPayment)
    ? Infinity
    : Math.ceil(-Math.log(1 - (ccMonthlyRate * toNum(ccBalance)) / toNum(ccPayment)) / Math.log(1 + ccMonthlyRate));

  const retN = Math.max(1, toNum(retYears) * 12);
  const retMr = (toNum(retRate) / 100) / 12;
  const retFutureCurrent = toNum(retCurrent) * ((1 + retMr) ** retN);
  const retFutureContrib = retMr === 0
    ? toNum(retMonthly) * retN
    : toNum(retMonthly) * ((((1 + retMr) ** retN) - 1) / retMr);
  const retirementCorpus = retFutureCurrent + retFutureContrib;

  const tipAmount = toNum(tipBill) * (toNum(tipPct) / 100);
  const tipTotal = toNum(tipBill) + tipAmount;
  const tipPerPerson = tipTotal / Math.max(1, toNum(tipPeople));

  const basicResult = (() => {
    const a = toNum(basicA);
    const b = toNum(basicB);
    if (basicOp === '+') return a + b;
    if (basicOp === '-') return a - b;
    if (basicOp === '*') return a * b;
    if (basicOp === '/') return b === 0 ? '∞' : a / b;
    return 0;
  })();

  const aprEstimated = (() => {
    const principal = toNum(aprPrincipal);
    const fee = toNum(aprFee);
    const financed = principal - fee;
    const payment = toNum(aprPmt);
    const months = Math.max(1, toNum(aprMonths));
    if (financed <= 0 || payment <= 0) return 0;

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 70; i += 1) {
      const mid = (lo + hi) / 2;
      const lhs = mid === 0 ? financed / months : (financed * mid * ((1 + mid) ** months)) / (((1 + mid) ** months) - 1);
      if (lhs > payment) hi = mid;
      else lo = mid;
    }
    return ((lo + hi) / 2) * 12 * 100;
  })();

  const roiPct = toNum(roiCost) === 0 ? 0 : ((toNum(roiValue) - toNum(roiCost)) / toNum(roiCost)) * 100;

  const autoPrincipal = Math.max(0, toNum(autoPrice) - toNum(autoDown) - toNum(autoTrade));
  const autoR = (toNum(autoRate) / 100) / 12;
  const autoN = Math.max(1, toNum(autoMonths));
  const autoEmi = autoR === 0
    ? autoPrincipal / autoN
    : (autoPrincipal * autoR * ((1 + autoR) ** autoN)) / (((1 + autoR) ** autoN) - 1);

  const ccMinimum = Math.max(toNum(ccMinFixed), toNum(ccMinBalance) * (toNum(ccMinRate) / 100));

  const discounted = toNum(discPrice) * (1 - (toNum(discPct) / 100));
  const finalWithTax = discounted * (1 + (toNum(taxPct) / 100));

  const cashflows = npvCashflows
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
  const npv = cashflows.reduce(
    (acc, cf, idx) => acc + (cf / ((1 + toNum(npvRate) / 100) ** (idx + 1))),
    -toNum(npvInitial)
  );
  const irr = (() => {
    const flows = [-toNum(npvInitial), ...cashflows];
    if (flows.length < 2) return 0;
    let lo = -0.99;
    let hi = 10;
    const f = (r) => flows.reduce((sum, cf, t) => sum + (cf / ((1 + r) ** t)), 0);
    for (let i = 0; i < 90; i += 1) {
      const mid = (lo + hi) / 2;
      const v = f(mid);
      if (v > 0) lo = mid;
      else hi = mid;
    }
    return ((lo + hi) / 2) * 100;
  })();

  const percIsWhat = toNum(percY) === 0 ? 0 : (toNum(percX) / toNum(percY)) * 100;
  const percChangedValue = toNum(percChangeBase) * (1 + toNum(percChangePct) / 100);

  const bondC = toNum(bondFace) * (toNum(bondCoupon) / 100);
  const bondY = toNum(bondYield) / 100;
  const bondN = Math.max(1, toNum(bondYears));
  const bondPrice = bondY === 0
    ? (bondC * bondN) + toNum(bondFace)
    : (bondC * ((1 - (1 / ((1 + bondY) ** bondN))) / bondY)) + (toNum(bondFace) / ((1 + bondY) ** bondN));

  const stockInvested = toNum(stockShares) * toNum(stockBuy);
  const stockFuture = stockInvested * ((1 + toNum(stockGrowth) / 100) ** toNum(stockYears));

  const breakEvenUnits = (toNum(miscPrice) - toNum(miscVariable)) <= 0
    ? Infinity
    : toNum(miscFixed) / (toNum(miscPrice) - toNum(miscVariable));
  const grossMargin = toNum(miscPrice) === 0 ? 0 : ((toNum(miscPrice) - toNum(miscVariable)) / toNum(miscPrice)) * 100;

  const renderActive = () => {
    switch (active) {
      case 'tvm':
        return (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Present Value" value={tvmPv} onChange={setTvmPv} />
              <Field label="Payment" value={tvmPmt} onChange={setTvmPmt} />
              <Field label="Future Value" value={tvmFv} onChange={setTvmFv} />
              <Field label="Annual Rate %" value={tvmRate} onChange={setTvmRate} />
              <Field label="Periods" value={tvmPeriods} onChange={setTvmPeriods} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Compounding</span>
                <select value={tvmCompounding} onChange={(e) => setTvmCompounding(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  {Object.keys(tvmCompoundingMap).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Solve For</span>
                <select value={tvmSolveFor} onChange={(e) => setTvmSolveFor(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  <option value="pv">PV</option>
                  <option value="pmt">PMT</option>
                  <option value="fv">FV</option>
                  <option value="rate">RATE</option>
                  <option value="period">PERIOD</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Mode</span>
                <div className="flex gap-4 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <label className="flex items-center gap-1"><input type="radio" checked={tvmMode === 'end'} onChange={() => setTvmMode('end')} /> End</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={tvmMode === 'beginning'} onChange={() => setTvmMode('beginning')} /> Beginning</label>
                </div>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Decimal Digits</span>
                <div className="flex gap-4 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  {[2, 3, 4].map((n) => (
                    <label key={n} className="flex items-center gap-1"><input type="radio" checked={tvmDecimals === n} onChange={() => setTvmDecimals(n)} /> {n}</label>
                  ))}
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <ActionButton onClick={resetTvm} className="bg-blue-600 hover:bg-blue-500"><RotateCcw size={14} /> Reset</ActionButton>
              <ActionButton onClick={() => setTvmMessage('Instruction: choose Solve For, fill other values, then click Calculate.')} className="bg-slate-700 hover:bg-slate-600">Instruction</ActionButton>
              <ActionButton onClick={loadTvmExample} className="bg-blue-600 hover:bg-blue-500">Example</ActionButton>
              <ActionButton onClick={solveTVM} className="bg-emerald-600 hover:bg-emerald-500">Calculate</ActionButton>
              <ActionButton onClick={saveTvmScenario} className="bg-emerald-700 hover:bg-emerald-600"><Save size={14} /> Save</ActionButton>
              <ActionButton onClick={emailTvmSummary} className="bg-emerald-700 hover:bg-emerald-600"><Mail size={14} /> Email</ActionButton>
              <ActionButton onClick={() => setTvmMessage(`History entries: ${tvmHistory.length}`)} className="bg-blue-600 hover:bg-blue-500"><History size={14} /> History</ActionButton>
            </div>

            {tvmMessage && <p className="text-xs text-emerald-300">{tvmMessage}</p>}

            <div className="grid md:grid-cols-2 gap-3">
              <Result label="Computed Future Value" value={formatCurrency(toNum(tvmFv || tvmComputedFv), tvmDecimals)} />
              <Result label="Effective Annual Rate" value={formatPercent((((1 + tvmRatePerPeriod) ** tvmCompoundingMap[tvmCompounding]) - 1) * 100, tvmDecimals)} tone="text-cyan-300" />
            </div>

            {tvmHistory.length > 0 && (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
                <p className="text-sm text-white font-semibold mb-2">Recent TVM History</p>
                <div className="space-y-1 max-h-40 overflow-auto pr-2">
                  {tvmHistory.slice(0, 6).map((h) => (
                    <div key={h.at} className="text-xs text-slate-300 border-b border-slate-700/40 pb-1">
                      {new Date(h.at).toLocaleString('en-IN')} • PV {formatCurrency(h.pv)} • PMT {formatCurrency(h.pmt)} • FV {formatCurrency(h.fv)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case 'currency':
        return (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Amount (base)" value={currAmount} onChange={setCurrAmount} />
              <Field label="Conversion Rate" value={currRate} onChange={setCurrRate} />
            </div>
            <Result label="Converted Amount" value={formatCurrency(currencyOut)} />
          </>
        );

      case 'loan':
        return (
          <>
            <div className="grid md:grid-cols-5 gap-3">
              <Field label="Loan Amount" value={loanPrincipal} onChange={setLoanPrincipal} />
              <Field label="Interest Rate % (annual)" value={loanRate} onChange={setLoanRate} />
              <Field label="Loan Term (years)" value={loanYears} onChange={setLoanYears} />
              <Field label="Loan Term (months extra)" value={loanMonthsExtra} onChange={setLoanMonthsExtra} />
              <Field label="Extra Payment / Month" value={loanExtraPayment} onChange={setLoanExtraPayment} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <ActionButton onClick={() => {
                setLoanPrincipal('150000'); setLoanRate('3.125'); setLoanYears('15'); setLoanMonthsExtra('0'); setLoanExtraPayment('100');
              }} className="bg-blue-600 hover:bg-blue-500">RESET</ActionButton>
              <ActionButton onClick={() => setLoanShowAmortization((s) => !s)} className="bg-emerald-700 hover:bg-emerald-600">ADVANCED</ActionButton>
              <ActionButton onClick={() => setLoanShowAmortization((s) => s)} className="bg-emerald-600 hover:bg-emerald-500">CALCULATE</ActionButton>
              <ActionButton onClick={emailLoanSummary} className="bg-emerald-700 hover:bg-emerald-600"><Mail size={14} /> EMAIL</ActionButton>
              <ActionButton onClick={() => {
                const body = `Base Interest: ${baseSchedule.totalInterest.toFixed(2)} | Extra Interest: ${extraSchedule.totalInterest.toFixed(2)} | Saving: ${loanInterestSaving.toFixed(2)}`;
                window.alert(`Report\n${body}`);
              }} className="bg-emerald-700 hover:bg-emerald-600"><FileText size={14} /> REPORT</ActionButton>
              <ActionButton onClick={exportLoanAmortization} className="bg-emerald-700 hover:bg-emerald-600"><Table size={14} /> AMORTIZATION</ActionButton>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <Result label="Monthly Payment" value={formatCurrency(loanEmi)} tone="text-red-300" />
              <Result label="Total Payment" value={formatCurrency(baseSchedule.totalPayment)} tone="text-red-300" />
              <Result label="Total Interest" value={formatCurrency(baseSchedule.totalInterest)} tone="text-red-300" />
              <Result label="Annual Payment" value={formatCurrency(annualPayment)} tone="text-red-300" />
              <Result label="Mortgage Constant" value={formatPercent(mortgageConstant)} tone="text-red-300" />
              <Result label="With Additional Payment: Interest Saving" value={formatCurrency(loanInterestSaving)} tone="text-cyan-300" />
              <Result label="Payoff Earlier By" value={`${Math.max(0, payoffEarlierMonths)} months`} tone="text-cyan-300" />
              <Result label="Months (base)" value={`${baseSchedule.months}`} />
              <Result label="Months (with extra)" value={`${extraSchedule.months}`} />
            </div>

            {loanShowAmortization && (
              <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                <div className="px-3 py-2 bg-slate-900/70 text-xs text-slate-300">Amortization Schedule (with extra payment)</div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900/60 text-slate-300 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1">Month</th>
                        <th className="text-left px-2 py-1">Payment</th>
                        <th className="text-left px-2 py-1">Interest</th>
                        <th className="text-left px-2 py-1">Principal</th>
                        <th className="text-left px-2 py-1">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraSchedule.rows.slice(0, 240).map((r) => (
                        <tr key={r.month} className="border-t border-slate-800/80">
                          <td className="px-2 py-1">{r.month}</td>
                          <td className="px-2 py-1">{formatCurrency(r.payment)}</td>
                          <td className="px-2 py-1">{formatCurrency(r.interest)}</td>
                          <td className="px-2 py-1">{formatCurrency(r.principal)}</td>
                          <td className="px-2 py-1">{formatCurrency(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );

      case 'compound':
        return (
          <>
            <div className="grid md:grid-cols-5 gap-3">
              <Field label="Principal Amount" value={compPrincipal} onChange={setCompPrincipal} />
              <Field label="Monthly Deposit" value={compMonthlyDeposit} onChange={setCompMonthlyDeposit} />
              <Field label="Period (months)" value={compPeriodMonths} onChange={setCompPeriodMonths} />
              <Field label="Annual Interest Rate %" value={compRate} onChange={setCompRate} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Compounding</span>
                <select value={compounding} onChange={(e) => setCompounding(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  {Object.keys(tvmCompoundingMap).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <ActionButton onClick={() => {
                setCompPrincipal('10000'); setCompMonthlyDeposit('1000'); setCompPeriodMonths('12'); setCompRate('2.125'); setCompounding('Monthly');
              }} className="bg-blue-600 hover:bg-blue-500">RESET</ActionButton>
              <ActionButton onClick={() => setCompoundShowTable(false)} className="bg-emerald-600 hover:bg-emerald-500">CALCULATE</ActionButton>
              <ActionButton onClick={emailCompoundSummary} className="bg-emerald-700 hover:bg-emerald-600"><Mail size={14} /> EMAIL</ActionButton>
              <ActionButton onClick={() => window.alert(`Report\nTotal Principal: ${compTotalPrincipal.toFixed(2)}\nInterest: ${compInterestAmount.toFixed(2)}\nMaturity: ${compMaturityValue.toFixed(2)}\nAPY: ${compApy.toFixed(4)}%`)} className="bg-emerald-700 hover:bg-emerald-600"><FileText size={14} /> REPORT</ActionButton>
              <ActionButton onClick={() => setCompoundShowTable((s) => !s)} className="bg-emerald-700 hover:bg-emerald-600"><Table size={14} /> TABLE</ActionButton>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              <Result label="Total Principal" value={formatCurrency(compTotalPrincipal)} tone="text-red-300" />
              <Result label="Interest Amount" value={formatCurrency(compInterestAmount)} tone="text-red-300" />
              <Result label="Maturity Value" value={formatCurrency(compMaturityValue)} tone="text-red-300" />
              <Result label="APY" value={formatPercent(compApy, 4)} tone="text-red-300" />
            </div>

            {compoundShowTable && (
              <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                <div className="px-3 py-2 bg-slate-900/70 text-xs text-slate-300 flex justify-between">
                  <span>Growth Table</span>
                  <button onClick={exportCompoundTable} className="text-cyan-300 hover:text-cyan-200">Export CSV</button>
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900/60 text-slate-300 sticky top-0">
                      <tr><th className="px-2 py-1 text-left">Month</th><th className="px-2 py-1 text-left">Balance</th></tr>
                    </thead>
                    <tbody>
                      {compoundTable.map((r) => (
                        <tr key={r.month} className="border-t border-slate-800/80">
                          <td className="px-2 py-1">{r.month}</td>
                          <td className="px-2 py-1">{formatCurrency(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );

      case 'ccPayoff':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Card Balance" value={ccBalance} onChange={setCcBalance} />
              <Field label="APR %" value={ccApr} onChange={setCcApr} />
              <Field label="Monthly Payment" value={ccPayment} onChange={setCcPayment} />
            </div>
            <Result label="Estimated Months to Payoff" value={ccMonths === Infinity ? 'Payment too low' : `${ccMonths} months`} />
          </>
        );

      case 'retirement':
        return (
          <>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Current Savings" value={retCurrent} onChange={setRetCurrent} />
              <Field label="Monthly Contribution" value={retMonthly} onChange={setRetMonthly} />
              <Field label="Expected Annual Return %" value={retRate} onChange={setRetRate} />
              <Field label="Years to Grow" value={retYears} onChange={setRetYears} />
            </div>
            <Result label="Projected Corpus" value={formatCurrency(retirementCorpus)} />
            <ListPanel title="Retirement Calculator List" items={retirementTools} />
          </>
        );

      case 'tip':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Bill Amount" value={tipBill} onChange={setTipBill} />
              <Field label="Tip %" value={tipPct} onChange={setTipPct} />
              <Field label="Split Between People" value={tipPeople} onChange={setTipPeople} />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Result label="Tip Amount" value={formatCurrency(tipAmount)} />
              <Result label="Total Bill" value={formatCurrency(tipTotal)} />
              <Result label="Per Person" value={formatCurrency(tipPerPerson)} />
            </div>
          </>
        );

      case 'basic':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Value A" value={basicA} onChange={setBasicA} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Operation</span>
                <select value={basicOp} onChange={(e) => setBasicOp(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  <option value="+">+</option>
                  <option value="-">-</option>
                  <option value="*">×</option>
                  <option value="/">÷</option>
                </select>
              </label>
              <Field label="Value B" value={basicB} onChange={setBasicB} />
            </div>
            <Result label="Result" value={String(basicResult)} />
          </>
        );

      case 'apr':
        return (
          <>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Loan Amount" value={aprPrincipal} onChange={setAprPrincipal} />
              <Field label="Upfront Fees" value={aprFee} onChange={setAprFee} />
              <Field label="Monthly Payment" value={aprPmt} onChange={setAprPmt} />
              <Field label="Tenure (months)" value={aprMonths} onChange={setAprMonths} />
            </div>
            <Result label="Estimated APR" value={formatPercent(aprEstimated)} />
          </>
        );

      case 'roi':
        return (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Investment Cost" value={roiCost} onChange={setRoiCost} />
              <Field label="Current Value / Return" value={roiValue} onChange={setRoiValue} />
            </div>
            <Result label="ROI" value={formatPercent(roiPct)} />
          </>
        );

      case 'autoLoan':
        return (
          <>
            <div className="grid md:grid-cols-5 gap-3">
              <Field label="Car Price" value={autoPrice} onChange={setAutoPrice} />
              <Field label="Down Payment" value={autoDown} onChange={setAutoDown} />
              <Field label="Trade-in Value" value={autoTrade} onChange={setAutoTrade} />
              <Field label="Rate %" value={autoRate} onChange={setAutoRate} />
              <Field label="Months" value={autoMonths} onChange={setAutoMonths} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Result label="Financed Amount" value={formatCurrency(autoPrincipal)} />
              <Result label="Estimated Monthly EMI" value={formatCurrency(autoEmi)} />
            </div>
          </>
        );

      case 'ccMinimum':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Card Balance" value={ccMinBalance} onChange={setCcMinBalance} />
              <Field label="Minimum % Rule" value={ccMinRate} onChange={setCcMinRate} />
              <Field label="Minimum Fixed Amount" value={ccMinFixed} onChange={setCcMinFixed} />
            </div>
            <Result label="Estimated Minimum Due" value={formatCurrency(ccMinimum)} />
          </>
        );

      case 'discountTax':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Original Price" value={discPrice} onChange={setDiscPrice} />
              <Field label="Discount %" value={discPct} onChange={setDiscPct} />
              <Field label="Tax %" value={taxPct} onChange={setTaxPct} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Result label="After Discount" value={formatCurrency(discounted)} />
              <Result label="Final Price (incl. tax)" value={formatCurrency(finalWithTax)} />
            </div>
          </>
        );

      case 'irrNpv':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Initial Investment" value={npvInitial} onChange={setNpvInitial} />
              <Field label="Discount Rate %" value={npvRate} onChange={setNpvRate} />
              <Field label="Cashflows (comma-separated)" value={npvCashflows} onChange={setNpvCashflows} type="text" placeholder="30000,35000,40000" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Result label="NPV" value={formatCurrency(npv)} />
              <Result label="Estimated IRR" value={formatPercent(irr)} />
            </div>
          </>
        );

      case 'percentage':
        return (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="X (part value)" value={percX} onChange={setPercX} />
              <Field label="Y (whole value)" value={percY} onChange={setPercY} />
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <Field label="Base for % Change" value={percChangeBase} onChange={setPercChangeBase} />
              <Field label="Change % (+/-)" value={percChangePct} onChange={setPercChangePct} />
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <Result label="X is what % of Y" value={formatPercent(percIsWhat)} />
              <Result label="Base after % Change" value={formatCurrency(percChangedValue)} />
            </div>
          </>
        );

      case 'bond':
        return (
          <>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Face Value" value={bondFace} onChange={setBondFace} />
              <Field label="Coupon Rate %" value={bondCoupon} onChange={setBondCoupon} />
              <Field label="Yield %" value={bondYield} onChange={setBondYield} />
              <Field label="Years to Maturity" value={bondYears} onChange={setBondYears} />
            </div>
            <Result label="Estimated Bond Price" value={formatCurrency(bondPrice)} />
          </>
        );

      case 'stock':
        return (
          <>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Shares" value={stockShares} onChange={setStockShares} />
              <Field label="Buy Price / Share" value={stockBuy} onChange={setStockBuy} />
              <Field label="Expected Annual Growth %" value={stockGrowth} onChange={setStockGrowth} />
              <Field label="Years" value={stockYears} onChange={setStockYears} />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Result label="Total Invested" value={formatCurrency(stockInvested)} />
              <Result label="Projected Value" value={formatCurrency(stockFuture)} />
              <Result label="Projected Gain" value={formatCurrency(stockFuture - stockInvested)} tone="text-cyan-300" />
            </div>
            <ListPanel title="Stock Calculator List" items={stockTools} />
          </>
        );

      case 'misc':
        return (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Fixed Costs" value={miscFixed} onChange={setMiscFixed} />
              <Field label="Selling Price / Unit" value={miscPrice} onChange={setMiscPrice} />
              <Field label="Variable Cost / Unit" value={miscVariable} onChange={setMiscVariable} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Result label="Break-even Units" value={breakEvenUnits === Infinity ? 'Not reachable' : Number(breakEvenUnits).toFixed(2)} />
              <Result label="Gross Margin" value={formatPercent(grossMargin)} />
            </div>
            <ListPanel title="Miscellaneous Calculation" items={miscTools} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel p-5 md:p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Calculators Center</h2>
        <p className="text-slate-400 text-sm">Multi-purpose finance and business calculators for daily decision making — optimized for quick, comfortable workflow.</p>
      </div>

      <div className="glass-panel p-5 md:p-6">
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calculator (loan, ROI, tax, stock...)"
              className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white"
            />
          </div>

          {recentCalculators.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1"><Clock3 size={12} /> Recent</span>
              {recentCalculators.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`px-2.5 py-1.5 rounded-full text-xs border ${active === c.id ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-slate-700/60 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {pinnedFavoriteCalculators.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-300 flex items-center gap-1"><Star size={12} /> Pinned Order (drag / long-press)</span>
              {mobileReorderMode && (
                <button
                  onClick={() => {
                    setMobileReorderMode(false);
                    setMobilePickFavoriteId(null);
                  }}
                  className="px-2.5 py-1.5 rounded-full text-xs border border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                >
                  Done
                </button>
              )}
              {pinnedFavoriteCalculators.map((c) => (
                <button
                  key={`pin-${c.id}`}
                  draggable
                  onDragStart={() => setDragFavoriteId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    reorderFavorites(dragFavoriteId, c.id);
                    setDragFavoriteId(null);
                  }}
                  onDragEnd={() => setDragFavoriteId(null)}
                  onTouchStart={() => handleFavoriteTouchStart(c.id)}
                  onTouchEnd={handleFavoriteTouchEnd}
                  onTouchCancel={handleFavoriteTouchEnd}
                  onClick={() => handlePinnedFavoriteClick(c.id)}
                  className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${dragFavoriteId === c.id || mobilePickFavoriteId === c.id ? 'border-amber-300 bg-amber-400/20 text-amber-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`}
                  title="Drag (desktop) or long-press then tap target (mobile)"
                >
                  <span className="mr-1 opacity-70">⠿</span>
                  {c.label}
                </button>
              ))}
              {mobileReorderMode && (
                <span className="text-[11px] text-cyan-300">Selected: {pinnedFavoriteCalculators.find((x) => x.id === mobilePickFavoriteId)?.label || '-'}</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayedCalculators.map((item) => {
            const Icon = item.icon;
            const activeState = active === item.id;
            const isFavorite = favoriteCalcIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`text-left rounded-xl border px-3 py-3 transition-all ${
                  activeState
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={activeState ? 'text-emerald-300' : 'text-slate-400'} />
                    <span className="text-xs text-slate-300">Calculator</span>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(item.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }
                    }}
                    className={`p-1 rounded ${isFavorite ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
                    aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                  >
                    <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                  </span>
                </div>
                <p className="text-sm font-medium text-white leading-snug">{item.label}</p>
                {isFavorite && <p className="text-[10px] text-amber-300 mt-1">★ Favorite</p>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-panel p-5 md:p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">
            {calcTypes.find((c) => c.id === active)?.label}
          </h3>
          <button
            onClick={() => toggleFavorite(active)}
            className={`px-2.5 py-1.5 rounded-full text-xs border flex items-center gap-1 ${favoriteCalcIds.includes(active) ? 'border-amber-400/50 bg-amber-500/10 text-amber-300' : 'border-slate-700/70 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60'}`}
          >
            <Star size={12} fill={favoriteCalcIds.includes(active) ? 'currentColor' : 'none'} />
            {favoriteCalcIds.includes(active) ? 'Favorited' : 'Favorite'}
          </button>
        </div>
        {renderActive()}
      </div>
    </div>
  );
};

export default Calculators;
