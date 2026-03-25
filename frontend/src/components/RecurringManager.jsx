import React, { useContext, useEffect, useState } from 'react';
import { Repeat, Plus, Trash2, Play } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../services/api';

const RecurringManager = ({ onRefreshTransactions }) => {
  const { token } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Other');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10));

  const loadRecurring = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest('/api/recurring', { token });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Recurring fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecurring();
  }, [token]);

  const addRecurring = async (e) => {
    e.preventDefault();
    if (!title || !amount || !category) return;

    try {
      await apiRequest('/api/recurring', {
        method: 'POST',
        token,
        body: {
          title,
          amount: Number(amount),
          type,
          category,
          frequency,
          next_date: new Date(nextDate).toISOString(),
        },
      });

      setTitle('');
      setAmount('');
      setCategory('Other');
      setFrequency('monthly');
      setNextDate(new Date().toISOString().slice(0, 10));
      await loadRecurring();
    } catch (err) {
      alert(err.message || 'Failed to create recurring transaction.');
    }
  };

  const removeRecurring = async (id) => {
    if (!window.confirm('Delete recurring transaction?')) return;
    try {
      await apiRequest(`/api/recurring/${id}`, {
        method: 'DELETE',
        token,
      });
      await loadRecurring();
    } catch (err) {
      alert(err.message || 'Failed to delete recurring transaction.');
    }
  };

  const runDue = async () => {
    try {
      const result = await apiRequest('/api/recurring/run-due', {
        method: 'POST',
        token,
      });
      await loadRecurring();
      if (onRefreshTransactions) await onRefreshTransactions();
      alert(`Processed recurring entries. Created ${result.created || 0} transaction(s).`);
    } catch (err) {
      alert(err.message || 'Failed to process due recurring transactions.');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Repeat size={18} className="text-indigo-400" /> Recurring Transactions
        </h3>
        <button
          onClick={runDue}
          className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 text-xs font-semibold flex items-center gap-1"
        >
          <Play size={14} /> Run Due
        </button>
      </div>

      <form onSubmit={addRecurring} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
          required
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
          required
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
          required
        />
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          type="date"
          value={nextDate}
          onChange={(e) => setNextDate(e.target.value)}
          className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
          required
        />

        <button type="submit" className="md:col-span-2 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold flex items-center justify-center gap-2">
          <Plus size={16} /> Add Recurring Rule
        </button>
      </form>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading recurring rules...</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm">No recurring rules yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-slate-900/40 border border-slate-700/40 rounded-lg">
              <div>
                <p className="text-white text-sm font-medium">{item.title} • ₹{item.amount} • {item.frequency}</p>
                <p className="text-xs text-slate-400">{item.type} • {item.category} • next: {new Date(item.next_date).toLocaleDateString('en-IN')}</p>
              </div>
              <button onClick={() => removeRecurring(item.id)} className="p-2 text-slate-500 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringManager;
