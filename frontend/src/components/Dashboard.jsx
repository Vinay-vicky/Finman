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
    if (isNaN(txDate.getTime())) txDate = new Date();
    
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
    <div className="flex flex-col gap-6">
      
      {/* Header and Filter Tabs */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Financial Overview</h2>
          <p className="text-slate-400 text-sm mt-1">Track your spending and income</p>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-700/50 w-fit">
          {['day', 'week', 'month', 'all'].map(mode => (
            <button 
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterMode === mode 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {mode === 'day' ? 'Today' : mode === 'week' ? 'This Week' : mode === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Balance</p>
          <p className={`text-4xl font-extrabold ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
            {formatCurrency(balance)}
          </p>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 text-emerald-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.8l7.5 15H4.5L12 5.8z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Income</p>
          <p className="text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 text-red-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22L2 2h20L12 22zm0-3.8l7.5-15H4.5L12 18.2z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Expense</p>
          <p className="text-4xl font-extrabold text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.3)]">
            {formatCurrency(totalExpense)}
          </p>
        </div>
      </div>

      {/* Main Grid: Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <div className="sticky top-6">
          <TransactionForm onAdd={onAddTransaction} />
        </div>
        <div className="glass-panel p-6">
          <TransactionList transactions={filteredTransactions} onDelete={onDeleteTransaction} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
