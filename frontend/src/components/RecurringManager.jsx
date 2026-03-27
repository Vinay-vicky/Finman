import React, { useContext, useEffect, useState } from 'react';
import { Repeat, Plus, Trash2, Play, Pencil, PauseCircle, PlayCircle } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import INRLoader from './INRLoader';

const RecurringManager = ({ onRefreshTransactions }) => {
  const { token } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Other');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10));

  const titleError = title.trim().length === 0 ? 'Title is required.' : '';
  const amountError = !amount || Number(amount) <= 0 ? 'Amount must be greater than 0.' : '';
  const categoryError = category.trim().length === 0 ? 'Category is required.' : '';
  const nextDateError = !nextDate ? 'Next date is required.' : '';
  const isFormInvalid = Boolean(titleError || amountError || categoryError || nextDateError);

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
    if (isFormInvalid) return;

    try {
      const payload = {
        title,
        amount: Number(amount),
        type,
        category,
        frequency,
        next_date: new Date(nextDate).toISOString(),
        paused: false,
      };

      await apiRequest(editingId ? `/api/recurring/${editingId}` : '/api/recurring', {
        method: editingId ? 'PUT' : 'POST',
        token,
        body: payload,
      });

      setTitle('');
      setAmount('');
      setCategory('Other');
      setFrequency('monthly');
      setNextDate(new Date().toISOString().slice(0, 10));
      setEditingId(null);
      await loadRecurring();
    } catch (err) {
      alert(err.message || `Failed to ${editingId ? 'update' : 'create'} recurring transaction.`);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setAmount(String(item.amount || ''));
    setType(item.type || 'expense');
    setCategory(item.category || 'Other');
    setFrequency(item.frequency || 'monthly');
    setNextDate(new Date(item.next_date).toISOString().slice(0, 10));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCategory('Other');
    setFrequency('monthly');
    setNextDate(new Date().toISOString().slice(0, 10));
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

  const togglePaused = async (item) => {
    try {
      await apiRequest(`/api/recurring/${item.id}`, {
        method: 'PUT',
        token,
        body: {
          title: item.title,
          amount: Number(item.amount),
          type: item.type,
          category: item.category,
          frequency: item.frequency,
          next_date: item.next_date,
          paused: !(Number(item.paused) === 1),
        },
      });

      await loadRecurring();
    } catch (err) {
      alert(err.message || 'Failed to toggle pause state.');
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
        {titleError && <p className="md:col-span-2 -mt-2 text-[11px] text-amber-300">{titleError}</p>}
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
          required
        />
        {amountError && <p className="md:col-span-2 -mt-2 text-[11px] text-amber-300">{amountError}</p>}
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
        {categoryError && <p className="md:col-span-2 -mt-2 text-[11px] text-amber-300">{categoryError}</p>}
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
        {nextDateError && <p className="md:col-span-2 -mt-2 text-[11px] text-amber-300">{nextDateError}</p>}

        <div className="md:col-span-2 flex gap-2">
          <button type="submit" disabled={isFormInvalid} className="flex-1 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2">
            <Plus size={16} /> {editingId ? 'Update Recurring Rule' : 'Add Recurring Rule'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="py-2">
          <INRLoader label="Loading recurring rules..." size="sm" compact />
        </div>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm">No recurring rules yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-slate-900/40 border border-slate-700/40 rounded-lg">
              <div>
                <p className="text-white text-sm font-medium">{item.title} • ₹{item.amount} • {item.frequency}</p>
                <p className="text-xs text-slate-400">{item.type} • {item.category} • next: {new Date(item.next_date).toLocaleDateString('en-IN')} {Number(item.paused) === 1 ? '• paused' : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePaused(item)} className="p-2 text-slate-500 hover:text-amber-400" title={Number(item.paused) === 1 ? 'Resume' : 'Pause'}>
                  {Number(item.paused) === 1 ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                </button>
                <button onClick={() => startEdit(item)} className="p-2 text-slate-500 hover:text-emerald-400" title="Edit rule">
                  <Pencil size={16} />
                </button>
                <button onClick={() => removeRecurring(item.id)} className="p-2 text-slate-500 hover:text-red-400" title="Delete rule">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringManager;
