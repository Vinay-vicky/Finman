import React, { useState, useEffect, useContext, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import Navigation from './components/Navigation';
import AnimatedBackground from './components/AnimatedBackground';
import INRLoader from './components/INRLoader';
import { AuthContext } from './context/AuthContext';
import { apiRequest } from './services/api';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Analytics = lazy(() => import('./components/Analytics'));
const Budgets = lazy(() => import('./components/Budgets'));
const Reports = lazy(() => import('./components/Reports'));
const Calculators = lazy(() => import('./components/Calculators'));
const Settings = lazy(() => import('./components/Settings'));
const NextLevel = lazy(() => import('./components/NextLevel'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));

const prefetchMap = {
  dashboard: () => import('./components/Dashboard'),
  analytics: () => import('./components/Analytics'),
  budgets: () => import('./components/Budgets'),
  reports: () => import('./components/Reports'),
  calculators: () => import('./components/Calculators'),
  settings: () => import('./components/Settings'),
  nextLevel: () => import('./components/NextLevel'),
};

const getPrefetchPolicy = () => {
  if (typeof navigator === 'undefined') {
    return {
      allowLightPrefetch: true,
      allowHeavyPrefetch: true,
    };
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const constrained = saveData || effectiveType.includes('2g');

  return {
    allowLightPrefetch: !constrained,
    allowHeavyPrefetch: !constrained && !effectiveType.includes('3g'),
  };
};

function App() {
  const location = useLocation();
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);
  const [dashboardInsights, setDashboardInsights] = useState({
    loading: false,
    error: null,
    healthScore: null,
    anomalyCount: 0,
    topAnomalies: [],
    upcomingBillsCount: 0,
    upcomingBillsAmount: 0,
    weeklyBrief: null,
    defaultHouseholdId: null,
    defaultHouseholdName: null,
    lastUpdated: null,
  });

  const prefetchRoute = useCallback((routeKey) => {
    const loader = prefetchMap[routeKey];
    if (loader) loader();
  }, []);

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiRequest('/api/transactions', {
        token,
      });
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardInsights = useCallback(async () => {
    if (!token || !user) return;

    setDashboardInsights((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [health, anomalies, bills, weeklyBrief, households] = await Promise.allSettled([
        apiRequest('/api/next-level/health/score', { token }),
        apiRequest('/api/next-level/transactions/anomalies', { token }),
        apiRequest('/api/next-level/bills/upcoming?dueWithinDays=14', { token }),
        apiRequest('/api/next-level/reports/weekly-brief', { token }),
        apiRequest('/api/next-level/households?page=1&limit=1', { token }),
      ]);

      const healthScore = health.status === 'fulfilled' ? Number(health.value?.score ?? 0) : null;
      const anomalyCount = anomalies.status === 'fulfilled'
        ? Number(anomalies.value?.anomalies?.length || 0)
        : 0;
      const topAnomalies = anomalies.status === 'fulfilled'
        ? (anomalies.value?.anomalies || [])
          .slice()
          .sort((a, b) => Number(b?.amount || 0) - Number(a?.amount || 0))
          .slice(0, 3)
        : [];
      const billsList = bills.status === 'fulfilled' && Array.isArray(bills.value)
        ? bills.value
        : [];
      const upcomingBillsAmount = billsList.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
      const brief = weeklyBrief.status === 'fulfilled' ? weeklyBrief.value : null;
      const firstHousehold = households.status === 'fulfilled'
        ? (households.value?.items || [])[0] || null
        : null;

      setDashboardInsights({
        loading: false,
        error: null,
        healthScore,
        anomalyCount,
        topAnomalies,
        upcomingBillsCount: billsList.length,
        upcomingBillsAmount,
        weeklyBrief: brief,
        defaultHouseholdId: firstHousehold?.id || null,
        defaultHouseholdName: firstHousehold?.name || null,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      setDashboardInsights((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Unable to load integrated insights.',
      }));
    }
  }, [token, user]);

  useEffect(() => {
    if (token) fetchTransactions();
    else setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

    fetchDashboardInsights();
    const timer = setInterval(fetchDashboardInsights, 180000);
    return () => clearInterval(timer);
  }, [token, user, fetchDashboardInsights]);

  useEffect(() => {
    if (!user) return;

    const { allowLightPrefetch, allowHeavyPrefetch } = getPrefetchPolicy();
    if (!allowLightPrefetch && !allowHeavyPrefetch) return;

    const prefetchLightRoutes = () => {
      prefetchRoute('analytics');
      prefetchRoute('budgets');
      prefetchRoute('reports');
    };

    const prefetchHeavyRoutes = () => {
      prefetchRoute('calculators');
      prefetchRoute('settings');
      prefetchRoute('nextLevel');
    };

    let idleId;
    let heavyTimer;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(prefetchLightRoutes, { timeout: 1500 });
      if (allowHeavyPrefetch) {
        heavyTimer = window.setTimeout(() => {
          window.requestIdleCallback(prefetchHeavyRoutes, { timeout: 2500 });
        }, 1800);
      }
      return () => {
        window.cancelIdleCallback?.(idleId);
        if (heavyTimer) window.clearTimeout(heavyTimer);
      };
    }

    const lightTimer = setTimeout(prefetchLightRoutes, 800);
    if (allowHeavyPrefetch) {
      heavyTimer = setTimeout(prefetchHeavyRoutes, 2600);
    }
    return () => {
      clearTimeout(lightTimer);
      if (heavyTimer) clearTimeout(heavyTimer);
    };
  }, [user, prefetchRoute]);

  useGSAP(() => {
    gsap.fromTo(
      '.route-shell',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'all' }
    );
  }, { dependencies: [location.pathname] });

  const handleAddTransaction = async (newTx) => {
    try {
      const data = await apiRequest('/api/transactions', {
        method: 'POST',
        token,
        body: newTx,
      });
      setTransactions([data, ...transactions]);
    } catch (err) {
      console.error('Failed to add transaction', err);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
        token,
      });
      setTransactions(transactions.filter((tx) => tx.id !== id));
    } catch (err) {
      console.error('Failed to delete transaction', err);
    }
  };

  const handleUpdateTransaction = async (updatedTx) => {
    try {
      const data = await apiRequest(`/api/transactions/${updatedTx.id}`, {
        method: 'PUT',
        token,
        body: {
          title: updatedTx.title,
          amount: updatedTx.amount,
          type: updatedTx.type,
          category: updatedTx.category,
          date: updatedTx.date,
        }
      });
      setTransactions(transactions.map((tx) => tx.id === updatedTx.id ? data : tx));
    } catch (err) {
      console.error('Failed to update transaction', err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground mode="loading" />
        <INRLoader label="Loading your workspace..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
        <AnimatedBackground mode="auth" />
        <header className="mb-8 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-2 tracking-tight">
            FinMan
          </h1>
          <p className="text-emerald-400 font-medium tracking-wide">Premium Expense Tracking</p>
        </header>
        
        <div className="w-full max-w-md">
          <Suspense fallback={<INRLoader label="Loading auth form..." size="sm" compact />}>
            {showLogin ? (
              <Login onSwitch={() => setShowLogin(false)} />
            ) : (
              <Signup onSwitch={() => setShowLogin(true)} />
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground mode="app" />
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-6 lg:p-8">
        <Navigation onPrefetchRoute={prefetchRoute} />
        
        <main className="flex-1 w-full min-w-0 pb-20 md:pb-8">
          {loading ? (
             <div className="flex items-center justify-center h-64">
               <INRLoader label="Loading your data..." size="md" />
             </div>
          ) : (
            <Suspense fallback={<div className="py-10"><INRLoader label="Loading page..." size="sm" compact /></div>}>
              <div className="route-shell">
                <Routes>
                  <Route path="/" element={
                    <Dashboard 
                      transactions={transactions} 
                      onAddTransaction={handleAddTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      onUpdateTransaction={handleUpdateTransaction}
                      onRefreshTransactions={fetchTransactions}
                      dashboardInsights={dashboardInsights}
                      onRefreshInsights={fetchDashboardInsights}
                    />
                  } />
                  <Route path="/analytics" element={<Analytics transactions={transactions} />} />
                  <Route path="/budgets" element={<Budgets />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/calculators" element={<Calculators />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/next-level" element={<NextLevel />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
