import React, { useState } from 'react';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';
import CalendarPicker from './CalendarPicker';
import RecurringManager from './RecurringManager';
import { Calendar, PlusCircle } from 'lucide-react';

const Dashboard = ({ transactions, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onRefreshTransactions }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filterMode, setFilterMode] = useState('date'); // 'date', 'week', 'month', 'year', 'all'

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

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header and Calendar Picker */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-600/50 transition-colors">
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

      {/* Balance Cards with 3D Effect */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance Card */}
        <div className="glass-panel p-6 relative overflow-hidden group rounded-2xl transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/30">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Balance</p>
          <p className={`text-4xl font-extrabold ${balance >= 0 ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.2)]'}`}>
            {formatCurrency(balance)}
          </p>
        </div>

        {/* Total Income Card */}
        <div className="glass-panel p-6 relative overflow-hidden group rounded-2xl transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 text-emerald-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.8l7.5 15H4.5L12 5.8z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Income</p>
          <p className="text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        {/* Total Expense Card */}
        <div className="glass-panel p-6 relative overflow-hidden group rounded-2xl transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-900/20">
          <div className="absolute inset-0 bg-gradient-to-br from-red-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 text-red-500">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22L2 2h20L12 22zm0-3.8l7.5-15H4.5L12 18.2z"/></svg>
          </div>
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Expense</p>
          <p className="text-4xl font-extrabold text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.4)]">
            {formatCurrency(totalExpense)}
          </p>
        </div>
      </div>

      {/* Main Grid: Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <div>
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
        <div className="glass-panel p-6 rounded-2xl">
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
