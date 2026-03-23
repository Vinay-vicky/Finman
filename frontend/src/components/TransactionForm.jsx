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
    <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(30, 41, 59, 0.4)' }}>
      <h3 style={{ marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 600 }}>Add Transaction</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type</label>
          <select 
            className="form-control" 
            value={type} 
            onChange={(e) => {
              setType(e.target.value);
              setCategory(categories[e.target.value][0]);
            }}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Title</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="e.g. Monthly Groceries" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Amount (₹) <span style={{fontSize: '0.8em', color:'var(--text-muted)'}}>(Math like 50+20 works)</span></label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="e.g. 50 + 20" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select 
            className="form-control" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories[type].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <PlusCircle size={18} /> Add {type === 'income' ? 'Income' : 'Expense'}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
