import React, { useContext, useEffect, useState } from 'react';
import { Shield, Trash2, LogOut, Activity, RefreshCw } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../services/api';

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN');
};

const formatPercent = (value) => `${Number((value || 0) * 100).toFixed(1)}%`;

const formatDurationMs = (ms) => {
  const value = Number(ms) || 0;
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
};

const getPerfHealthStatus = (perf) => {
  if (!perf) return { label: 'Unknown', className: 'text-slate-300 border-slate-500/40 bg-slate-500/10' };

  const hasError = Boolean(perf?.recurringJob?.lastError);
  const hitRate = Number(perf?.analyticsCache?.hitRate || 0);

  if (hasError) {
    return { label: 'Critical', className: 'text-red-300 border-red-500/40 bg-red-500/10' };
  }

  if (hitRate < 0.2) {
    return { label: 'Warning', className: 'text-amber-300 border-amber-500/40 bg-amber-500/10' };
  }

  return { label: 'Healthy', className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' };
};

const Settings = () => {
  const { token, logout } = useContext(AuthContext);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perf, setPerf] = useState(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState(null);
  const [lastPerfRefreshAt, setLastPerfRefreshAt] = useState(null);
  const perfStatus = getPerfHealthStatus(perf);

  const loadSessions = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest('/api/auth/sessions', { token });
      if (Array.isArray(data)) {
        setSessions(data);
        setCurrentSessionId(null);
      } else {
        setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
        setCurrentSessionId(data?.currentSessionId ?? null);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [token]);

  const loadPerf = async ({ silent = false } = {}) => {
    if (!silent) setPerfLoading(true);

    try {
      const data = await apiRequest('/api/health/perf', { token });
      setPerf(data);
      setPerfError(null);
      setLastPerfRefreshAt(new Date().toISOString());
    } catch (err) {
      console.error('Failed to load perf health:', err);
      setPerfError(err.message || 'Failed to load performance health data.');
    } finally {
      if (!silent) setPerfLoading(false);
    }
  };

  useEffect(() => {
    loadPerf();
    const intervalId = setInterval(() => {
      loadPerf({ silent: true });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [token]);

  const revokeSession = async (id) => {
    if (!window.confirm('Revoke this session?')) return;
    try {
      await apiRequest(`/api/auth/sessions/${id}`, {
        method: 'DELETE',
        token,
      });
      loadSessions();
    } catch (err) {
      alert(err.message || 'Failed to revoke session.');
    }
  };

  const logoutAll = async () => {
    if (!window.confirm('Logout from all devices?')) return;
    try {
      await apiRequest('/api/auth/logout-all', { method: 'POST', token });
      logout();
    } catch (err) {
      alert(err.message || 'Failed to logout all sessions.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Shield size={22} className="text-cyan-400" /> Session & Security</h2>
        <p className="text-slate-400 text-sm mt-1">Review active sessions and revoke access when needed.</p>
      </div>

      <div className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" /> Performance Monitor
          </h3>
          <div className="flex items-center gap-2">
            {!perfLoading && !perfError && (
              <span className={`text-xs px-2 py-1 rounded-full border ${perfStatus.className}`}>
                {perfStatus.label}
              </span>
            )}
            <button
              onClick={() => loadPerf()}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center gap-2"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {perfLoading ? (
          <p className="text-slate-400 text-sm">Loading performance data...</p>
        ) : perfError ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-amber-300 text-sm">{perfError}</p>
            <p className="text-amber-200/80 text-xs mt-1">Tip: deploy latest backend to enable `/api/health/perf`.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">Cache Hit Rate</p>
                <p className="text-lg font-bold text-emerald-300">{formatPercent(perf?.analyticsCache?.hitRate)}</p>
                <p className="text-[11px] text-slate-500">Hits: {perf?.analyticsCache?.hits ?? 0} • Misses: {perf?.analyticsCache?.misses ?? 0}</p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">Cache Size</p>
                <p className="text-lg font-bold text-cyan-300">{perf?.analyticsCache?.size ?? 0}</p>
                <p className="text-[11px] text-slate-500">Max: {perf?.analyticsCache?.maxEntries ?? '-'} • TTL: {formatDurationMs(perf?.analyticsCache?.ttlMs)}</p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">Recurring Job Runs</p>
                <p className="text-lg font-bold text-indigo-300">{perf?.recurringJob?.runs ?? 0}</p>
                <p className="text-[11px] text-slate-500">Lease skips: {perf?.recurringJob?.leaseSkips ?? 0}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 text-xs text-slate-400 space-y-1">
              <p>
                Last refresh: <span className="text-slate-300">{formatDateTime(lastPerfRefreshAt)}</span>
              </p>
              <p>
                Last recurring run: <span className="text-slate-300">{formatDateTime(perf?.recurringJob?.lastRunAt)}</span>
                {' '}• Duration: <span className="text-slate-300">{formatDurationMs(perf?.recurringJob?.lastDurationMs)}</span>
                {' '}• Created: <span className="text-slate-300">{perf?.recurringJob?.lastCreated ?? 0}</span>
              </p>
              {perf?.recurringJob?.lastError ? (
                <p className="text-red-300">Last recurring error: {perf.recurringJob.lastError}</p>
              ) : (
                <p>
                  Last recurring error: <span className="text-emerald-300">None</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Signed-in Sessions</h3>
          <button onClick={loadSessions} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">Refresh</button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500 text-sm">No sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/40 border border-slate-700/40 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium flex flex-wrap items-center gap-2">
                    <span>Session #{s.id} {s.revoked_at ? '(revoked)' : '(active)'}</span>
                    {Number(currentSessionId) === Number(s.id) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-300">Current device</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">Created: {formatDateTime(s.createdAt)} • Expires: {formatDateTime(s.expires_at)}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[520px]">{s.user_agent || 'Unknown device'} • IP: {s.ip_address || '-'}</p>
                </div>
                {!s.revoked_at && (
                  <button onClick={() => revokeSession(s.id)} className="self-end sm:self-auto p-2 text-slate-400 hover:text-red-400" title="Revoke session">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Danger Zone</h3>
        <div className="flex gap-3">
          <button onClick={logoutAll} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center gap-2">
            <LogOut size={16} /> Logout All Devices
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
