import React, { useState } from 'react';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';

const Dashboard = ({ transactions, onAddTransaction, onDeleteTransaction }) => {
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'day', 'week', 'month'

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const now = new Date();
  
  // Filter logic
  const filteredTransactions = transactions.filter(t => {
    let txDate = new Date(t.date);
    if (isNaN(txDate.getTime())) txDate = new Date(); // fallback for invalid dates
    
    if (filterMode === 'all') return true;
    
    if (filterMode === 'day') {
      return txDate.toDateString() === now.toDateString();
    }
    
    if (filterMode === 'week') {
      const diffTime = Math.abs(now - txDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays <= 7;
    }
    
    if (filterMode === 'month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    
    return true;
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
    
  const balance = totalIncome - totalExpense;

  return (
    <div className="glass-panel">
      
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setFilterMode('day')}
          className="btn" 
          style={{ width: 'auto', padding: '0.5rem 1.5rem', background: filterMode === 'day' ? 'var(--primary)' : 'rgba(15, 23, 42, 0.5)' }}>
          Today
        </button>
        <button 
          onClick={() => setFilterMode('week')}
          className="btn" 
          style={{ width: 'auto', padding: '0.5rem 1.5rem', background: filterMode === 'week' ? 'var(--primary)' : 'rgba(15, 23, 42, 0.5)' }}>
          This Week
        </button>
        <button 
          onClick={() => setFilterMode('month')}
          className="btn" 
          style={{ width: 'auto', padding: '0.5rem 1.5rem', background: filterMode === 'month' ? 'var(--primary)' : 'rgba(15, 23, 42, 0.5)' }}>
          This Month
        </button>
        <button 
          onClick={() => setFilterMode('all')}
          className="btn" 
          style={{ width: 'auto', padding: '0.5rem 1.5rem', background: filterMode === 'all' ? 'var(--primary)' : 'rgba(15, 23, 42, 0.5)' }}>
          All Time
        </button>
      </div>

      <div className="balance-cards">
        <div className="balance-card">
          <div className="balance-title">Balance ({filterMode.toUpperCase()})</div>
          <div className="balance-amount" style={{ color: balance >= 0 ? 'var(--text-main)' : 'var(--danger)' }}>
            {formatCurrency(balance)}
          </div>
        </div>
        <div className="balance-card">
          <div className="balance-title">Income</div>
          <div className="balance-amount amount-income">
            {formatCurrency(totalIncome)}
          </div>
        </div>
        <div className="balance-card">
          <div className="balance-title">Expense</div>
          <div className="balance-amount amount-expense">
            {formatCurrency(totalExpense)}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div>
          <TransactionForm onAdd={onAddTransaction} />
        </div>
        <div>
          <TransactionList transactions={filteredTransactions} onDelete={onDeleteTransaction} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
