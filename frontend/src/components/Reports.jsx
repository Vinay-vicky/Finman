import React, { useContext, useEffect, useMemo, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { apiDownload, apiRequest } from '../services/api';
import INRLoader from './INRLoader';

const toInputDate = (date) => date.toISOString().slice(0, 10);

const Reports = () => {
  const { token } = useContext(AuthContext);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toInputDate(d);
  });
  const [toDate, setToDate] = useState(() => toInputDate(new Date()));

  const query = useMemo(() => (
    `?from=${encodeURIComponent(new Date(fromDate).toISOString())}&to=${encodeURIComponent(new Date(toDate).toISOString())}`
  ), [fromDate, toDate]);

  const loadReport = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest(`/api/analytics/report${query}`, { token });
      setReport(data);
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [token]);

  const exportCsv = async () => {
    try {
      await apiDownload(`/api/analytics/report${query}&format=csv`, {
        token,
        filename: `report-${fromDate}-to-${toDate}.csv`,
      });
    } catch (err) {
      alert(err.message || 'Failed to export report.');
    }
  };

  if (loading) {
    return <div className="p-8"><INRLoader label="Loading reports..." size="md" compact /></div>;
  }

  if (error) {
    return (
      <div className="glass-panel p-6 bg-red-500/10 border-red-500/30">
        <h3 className="text-red-400 font-semibold mb-2">⚠️ Error Loading Reports</h3>
        <p className="text-red-300 text-sm mb-3">{error}</p>
        <button onClick={loadReport} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2"><FileText size={22} className="text-indigo-400" /> Reports Center</h2>
            <p className="text-slate-400 text-sm mt-1">Summary reports and trend exports for your selected date range.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-2 items-end w-full md:w-auto">
            <div className="w-full">
              <label className="text-xs text-slate-400">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="block w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="w-full">
              <label className="text-xs text-slate-400">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="block w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <button onClick={loadReport} className="w-full sm:w-auto px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold">Apply</button>
            <button onClick={exportCsv} className="w-full sm:w-auto px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-1"><Download size={14} /> CSV</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4"><p className="text-slate-400 text-xs">Income</p><p className="text-xl md:text-2xl font-bold text-emerald-400">₹{Number(report?.summary?.income || 0).toFixed(2)}</p></div>
        <div className="glass-panel p-4"><p className="text-slate-400 text-xs">Expense</p><p className="text-xl md:text-2xl font-bold text-red-400">₹{Number(report?.summary?.expense || 0).toFixed(2)}</p></div>
        <div className="glass-panel p-4"><p className="text-slate-400 text-xs">Balance</p><p className="text-xl md:text-2xl font-bold text-white">₹{Number(report?.summary?.balance || 0).toFixed(2)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-5">
          <h3 className="text-white font-semibold mb-3">Top Expense Categories</h3>
          {(report?.categories || []).length === 0 ? (
            <p className="text-slate-500 text-sm">No category data.</p>
          ) : (
            <div className="space-y-2">
              {report.categories.map((c) => (
                <div key={c.name} className="flex justify-between text-sm border-b border-slate-700/30 py-1">
                  <span className="text-slate-300">{c.name}</span>
                  <span className="text-white font-medium">₹{Number(c.value || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel p-5">
          <h3 className="text-white font-semibold mb-3">Monthly Trend</h3>
          {(report?.monthlyTrend || []).length === 0 ? (
            <p className="text-slate-500 text-sm">No trend data.</p>
          ) : (
            <div className="space-y-2">
              {report.monthlyTrend.map((m) => (
                <div key={m.month} className="grid grid-cols-3 text-sm border-b border-slate-700/30 py-1">
                  <span className="text-slate-300">{m.month}</span>
                  <span className="text-emerald-300">₹{Number(m.income || 0).toFixed(0)}</span>
                  <span className="text-red-300">₹{Number(m.expense || 0).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
