import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import Budgets from './components/Budgets';
import Login from './components/Login';
import Signup from './components/Signup';
import Navigation from './components/Navigation';
import { AuthContext } from './context/AuthContext';

function App() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
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

  const handleAddTransaction = async (newTx) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTx),
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions([data, ...transactions]);
      }
    } catch (err) {
      console.error('Failed to add transaction', err);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTransactions(transactions.filter((tx) => tx.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete transaction', err);
    }
  };

  if (authLoading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="app-container" style={{ maxWidth: '400px', marginTop: '5rem' }}>
        <header>
          <h1>FinMan</h1>
          <p style={{ color: 'var(--text-muted)' }}>Premium Expense Tracking</p>
        </header>
        {showLogin ? (
          <Login onSwitch={() => setShowLogin(false)} />
        ) : (
          <Signup onSwitch={() => setShowLogin(true)} />
        )}
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: '1400px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
        <Navigation />
        
        <main style={{ paddingBottom: '2rem' }}>
          {loading ? (
             <div style={{ textAlign: 'center', marginTop: '3rem' }}>
               <h2 style={{ color: 'var(--text-muted)' }}>Loading your data...</h2>
             </div>
          ) : (
            <Routes>
              <Route path="/" element={
                 <Dashboard 
                   transactions={transactions} 
                   onAddTransaction={handleAddTransaction}
                   onDeleteTransaction={handleDeleteTransaction}
                 />
              } />
              <Route path="/analytics" element={<Analytics transactions={transactions} />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
