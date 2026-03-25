import React, { useState, useEffect } from 'react';
import { PlusCircle, X } from 'lucide-react';

const TransactionForm = ({ onAdd, onUpdate, editingTransaction, onCancelEdit, selectedDate }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const categories = {
    income: ['Salary', 'Freelance', 'Investments', 'Other'],
    expense: ['Groceries', 'Utilities', 'Entertainment', 'Transport', 'Healthcare', 'Other']
  };

  useEffect(() => {
    if (editingTransaction) {
      setTitle(editingTransaction.title);
      setAmount(editingTransaction.amount.toString());
      setType(editingTransaction.type);
      setCategory(editingTransaction.category);
      const txDate = new Date(editingTransaction.date);
      setDate(txDate.toISOString().split('T')[0]);
    } else {
      resetForm();
      if (selectedDate) {
        setDate(selectedDate.toISOString().split('T')[0]);
      }
    }
  }, [editingTransaction, selectedDate]);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setType('expense');
    setCategory(categories.expense[0]);
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory(categories[newType][0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !amount || !category) return;
    
    let parsedAmount = 0;
    try {
      const safeMath = amount.replace(/[^0-9+\-*/.() ]/g, '');
      parsedAmount = Function(`'use strict'; return (${safeMath})`)();
    } catch (err) {
      alert('Invalid amount format. Example: 50 + 20');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Amount must be greater than zero');
      return;
    }

    const transactionData = {
      title,
      amount: parsedAmount,
      type,
      category,
      date: new Date(date).toISOString()
    };

    if (editingTransaction) {
      onUpdate({ ...editingTransaction, ...transactionData });
    } else {
      onAdd(transactionData);
    }

    resetForm();
  };

  return (
    <div className={`glass-panel p-6 rounded-2xl transform transition-all duration-300 ${editingTransaction ? 'bg-slate-800/90 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10' : 'bg-slate-800/80 hover:bg-slate-800/90 hover:border-slate-600/50'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">
          {editingTransaction ? '✏️ Edit Transaction' : 'Add Transaction'}
        </h3>
        {editingTransaction && (
          <button
            onClick={onCancelEdit}
            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            title="Cancel edit"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Type Toggle */}
        <div className="flex p-1 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-colors">
          <button 
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${type === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => handleTypeChange('expense')}
          >
            Expense
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${type === 'income' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => handleTypeChange('income')}
          >
            Income
          </button>
        </div>
        
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
          <input 
            type="text" 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all placeholder:text-slate-500 hover:bg-slate-900/70 hover:border-slate-600" 
            placeholder="e.g. Monthly Groceries" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-300">Amount (₹)</label>
            <span className="text-xs text-slate-500 italic">Supports math (e.g. 50+20)</span>
          </div>
          <input 
            type="text" 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all placeholder:text-slate-500 font-mono text-lg hover:bg-slate-900/70 hover:border-slate-600" 
            placeholder="0.00" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <select 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all hover:bg-slate-900/70 hover:border-slate-600 cursor-pointer"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {categories[type].map(cat => (
              <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
          <input 
            type="date"
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all hover:bg-slate-900/70 hover:border-slate-600 cursor-pointer"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {/* Submit Button */}
        <button 
          type="submit"
          className={`w-full py-3 px-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 ${
            editingTransaction 
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40' 
              : 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg shadow-slate-700/20 hover:shadow-slate-600/40'
          }`}
        >
          <PlusCircle size={20} />
          {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
