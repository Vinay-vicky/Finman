import React, { useState, useEffect, useContext, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import AnimatedBackground from './components/AnimatedBackground';
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

function App() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);

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

  useEffect(() => {
    if (token) fetchTransactions();
    else setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!user) return;

    const idlePrefetch = () => {
      prefetchRoute('analytics');
      prefetchRoute('budgets');
      prefetchRoute('reports');
      prefetchRoute('calculators');
      prefetchRoute('settings');
      prefetchRoute('nextLevel');
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(idlePrefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback?.(id);
    }

    const timer = setTimeout(idlePrefetch, 800);
    return () => clearTimeout(timer);
  }, [user, prefetchRoute]);

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
        <AnimatedBackground />
        <div className="text-slate-400 animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
        <AnimatedBackground />
        <header className="mb-8 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-2 tracking-tight">
            FinMan
          </h1>
          <p className="text-emerald-400 font-medium tracking-wide">Premium Expense Tracking</p>
        </header>
        
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="text-slate-400 animate-pulse text-center">Loading auth form...</div>}>
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
      <AnimatedBackground />
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-6 lg:p-8">
        <Navigation onPrefetchRoute={prefetchRoute} />
        
        <main className="flex-1 w-full min-w-0 pb-20 md:pb-8">
          {loading ? (
             <div className="flex items-center justify-center h-64">
               <h2 className="text-slate-400 animate-pulse text-lg">Loading your data...</h2>
             </div>
          ) : (
            <Suspense fallback={<div className="text-slate-400 animate-pulse text-center py-10">Loading page...</div>}>
              <div className="animate-fade-in">
                <Routes>
                  <Route path="/" element={
                    <Dashboard 
                      transactions={transactions} 
                      onAddTransaction={handleAddTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      onUpdateTransaction={handleUpdateTransaction}
                      onRefreshTransactions={fetchTransactions}
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
