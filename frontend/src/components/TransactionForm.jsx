import React, { useState } from 'react';
import { PlusCircle } from 'lucide-react';

const TransactionForm = ({ onAdd }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Groceries');

  const categories = {
    income: ['Salary', 'Freelance', 'Investments', 'Other'],
    expense: ['Groceries', 'Utilities', 'Entertainment', 'Transport', 'Healthcare', 'Other']
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !amount || !category) return;
    
    let parsedAmount = 0;
    try {
      // Very simple safe evaluation stripping out non-math chars
      const safeMath = amount.replace(/[^0-9+\-*/.() ]/g, '');
      parsedAmount = Function(`'use strict'; return (${safeMath})`)();
    } catch (err) {
      alert('Invalid matching in amount. Example matches format "50 + 20"');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Amount result must be greater than zero');
      return;
    }
    
    onAdd({
      title,
      amount: parsedAmount,
      type,
      category,
      date: new Date().toISOString()
    });

    setTitle('');
    setAmount('');
  };

  return (
    <div className="glass-panel p-6 bg-slate-800/80">
      <h3 className="text-xl font-bold text-white mb-6">Add Transaction</h3>
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Type Toggle */}
        <div className="flex p-1 bg-slate-900/50 rounded-xl border border-slate-700/50">
          <button 
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${type === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => { setType('expense'); setCategory(categories.expense[0]); }}
          >
            Expense
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${type === 'income' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => { setType('income'); setCategory(categories.income[0]); }}
          >
            Income
          </button>
        </div>
        
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
          <input 
            type="text" 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-500" 
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
            <span className="text-xs text-slate-500 italic">Math works (e.g. 50+20)</span>
          </div>
          <input 
            type="text" 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-500 font-mono text-lg" 
            placeholder="0.00" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <div className="relative">
            <select 
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories[type].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button 
          type="submit" 
          className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white mt-4 ${
            type === 'income' 
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/20' 
              : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-red-500/20'
          }`}
        >
          <PlusCircle size={20} /> 
          Add {type === 'income' ? 'Income' : 'Expense'}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
