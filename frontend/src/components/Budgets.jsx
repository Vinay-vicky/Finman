import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Target, Flag, Trash2, Plus, AlertTriangle, Tags } from 'lucide-react';
import { apiRequest } from '../services/api';
import INRLoader from './INRLoader';

const Budgets = () => {
  const { token } = useContext(AuthContext);

  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  const [bCategory, setBCategory] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [gName, setGName] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gDeadline, setGDeadline] = useState('');
  const [cName, setCName] = useState('');
  const [cType, setCType] = useState('expense');
  const [cColor, setCColor] = useState('#10b981');

  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [budgetsData, goalsData, catData, categoriesData] = await Promise.all([
        apiRequest('/api/budgets', { token }),
        apiRequest('/api/goals', { token }),
        apiRequest('/api/analytics/charts/category', { token }),
        apiRequest('/api/categories', { token }),
      ]);

      setBudgets(Array.isArray(budgetsData) ? budgetsData : []);
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);

      const catMap = {};
      (Array.isArray(catData) ? catData : []).forEach((c) => { catMap[c.name] = Number(c.value) || 0; });
      setExpensesByCategory(catMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const addBudget = async (e) => {
    e.preventDefault();
    if (!bCategory || !bAmount) return;
    const month = new Date().toISOString().slice(0, 7);

    try {
      await apiRequest('/api/budgets', {
        method: 'POST',
        token,
        body: { category: bCategory, amount: Number(bAmount), month },
      });
      setBCategory('');
      setBAmount('');
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to create budget.');
    }
  };

  const addGoal = async (e) => {
    e.preventDefault();
    if (!gName || !gTarget) return;

    try {
      await apiRequest('/api/goals', {
        method: 'POST',
        token,
        body: {
          name: gName,
          target_amount: Number(gTarget),
          current_amount: 0,
          deadline: gDeadline ? new Date(gDeadline).toISOString() : null,
        },
      });
      setGName('');
      setGTarget('');
      setGDeadline('');
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to create goal.');
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!cName) return;

    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        token,
        body: { name: cName, type: cType, color: cColor },
      });
      setCName('');
      setCColor('#10b981');
      setCType('expense');
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to create category.');
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm(`Delete ${type}?`)) return;

    const routeMap = {
      budget: 'budgets',
      goal: 'goals',
      category: 'categories',
    };

    try {
      await apiRequest(`/api/${routeMap[type] || `${type}s`}/${id}`, {
        method: 'DELETE',
        token,
      });
      fetchData();
    } catch (err) {
      alert(err.message || `Failed to delete ${type}.`);
    }
  };

  const getBudgetAlert = (spent, limit) => {
    const pct = (spent / limit) * 100;
    if (pct >= 100) return { label: 'Exceeded', color: 'text-red-400', icon: <AlertTriangle size={12} /> };
    if (pct >= 80) return { label: 'Critical (80%+)', color: 'text-amber-400', icon: <AlertTriangle size={12} /> };
    if (pct >= 50) return { label: 'Watch (50%+)', color: 'text-yellow-300', icon: <AlertTriangle size={12} /> };
    return { label: 'Healthy', color: 'text-emerald-300', icon: null };
  };

  if (loading) return (
    <div className="flex items-center justify-center p-10 h-64">
      <INRLoader label="Loading targets..." size="md" compact />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel shadow-none bg-transparent border-0 !p-0">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Budgets, Goals & Categories</h2>
        <p className="text-slate-400 text-sm">Set limits, monitor alerts, and manage transaction categories</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target size={24} className="text-blue-400" /> Monthly Budgets
          </h2>

          <form onSubmit={addBudget} className="flex gap-3 items-start bg-slate-900/30 p-4 rounded-xl border border-slate-700/30">
            <input
              type="text"
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm placeholder:text-slate-500 flex-[2]"
              placeholder="Category (e.g. Food)"
              value={bCategory}
              onChange={(e) => setBCategory(e.target.value)}
              required
            />
            <input
              type="number"
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm placeholder:text-slate-500 flex-[1]"
              placeholder="Limit ₹"
              value={bAmount}
              onChange={(e) => setBAmount(e.target.value)}
              required
            />
            <button type="submit" className="p-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5" title="Add Budget">
              <Plus size={20} />
            </button>
          </form>

          <div className="flex flex-col gap-5 mt-2">
            {budgets.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-700/50 rounded-xl">
                <p className="text-slate-500">No active budgets set.</p>
              </div>
            ) : budgets.map((b) => {
              const spent = expensesByCategory[b.category] || 0;
              const percent = Math.min((spent / b.amount) * 100, 100);
              const isOver = spent > b.amount;
              const alert = getBudgetAlert(spent, b.amount);
              return (
                <div key={b.id} className="relative group p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition-all">
                  <button
                    onClick={() => deleteItem('budget', b.id)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex justify-between items-end mb-3 pr-8">
                    <span className="font-semibold text-white">{b.category}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-400 mb-0.5">Spent / Limit</span>
                      <span className="text-sm">
                        <span className={`font-bold ${isOver ? 'text-red-400' : 'text-slate-200'}`}>₹{spent.toFixed(2)}</span>
                        <span className="text-slate-500"> / ₹{b.amount}</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/30">
                    <div className={`h-full rounded-full transition-all duration-700 ease-out ${isOver ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
                  </div>
                  <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${alert.color}`}>{alert.icon}{alert.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flag size={24} className="text-emerald-400" /> Savings Goals
          </h2>

          <form onSubmit={addGoal} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-start bg-slate-900/30 p-4 rounded-xl border border-slate-700/30">
            <input
              type="text"
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm placeholder:text-slate-500"
              placeholder="Goal (e.g. Vacation)"
              value={gName}
              onChange={(e) => setGName(e.target.value)}
              required
            />
            <input
              type="number"
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm placeholder:text-slate-500"
              placeholder="Target ₹"
              value={gTarget}
              onChange={(e) => setGTarget(e.target.value)}
              required
            />
            <input
              type="date"
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
              value={gDeadline}
              onChange={(e) => setGDeadline(e.target.value)}
            />
            <button type="submit" className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg shadow-lg shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5" title="Add Goal">
              <Plus size={20} />
            </button>
          </form>

          <div className="flex flex-col gap-5 mt-2">
            {goals.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-700/50 rounded-xl">
                <p className="text-slate-500">No savings goals set.</p>
              </div>
            ) : goals.map((g) => {
              const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
              const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));

              let requiredPerMonth = null;
              if (g.deadline) {
                const deadline = new Date(g.deadline);
                const now = new Date();
                const monthsLeft = Math.max(1, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()));
                requiredPerMonth = remaining / monthsLeft;
              }

              return (
                <div key={g.id} className="relative group p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition-all">
                  <button
                    onClick={() => deleteItem('goal', g.id)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex justify-between items-end mb-3 pr-8">
                    <span className="font-semibold text-white">{g.name}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-400 mb-0.5">Saved / Target</span>
                      <span className="text-sm">
                        <span className="font-bold text-emerald-400">₹{g.current_amount}</span>
                        <span className="text-slate-500"> / ₹{g.target_amount}</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/30">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${percent}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">Remaining: ₹{remaining.toFixed(2)}</p>
                  {g.deadline && (
                    <p className="text-xs text-emerald-300 mt-1">
                      Suggested monthly saving: ₹{(requiredPerMonth || 0).toFixed(2)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Tags size={18} className="text-violet-400" /> Category Management</h3>

        <form onSubmit={addCategory} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            placeholder="Category name"
            className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white"
            required
          />
          <select value={cType} onChange={(e) => setCType(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input type="color" value={cColor} onChange={(e) => setCColor(e.target.value)} className="h-10 bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1" />
          <button type="submit" className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold">Add Category</button>
        </form>

        {categories.length === 0 ? (
          <p className="text-slate-500 text-sm">No custom categories yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between bg-slate-900/40 border border-slate-700/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#10b981' }}></span>
                  <span className="text-sm text-white">{cat.name}</span>
                  <span className="text-xs text-slate-400">({cat.type || 'any'})</span>
                </div>
                <button onClick={() => deleteItem('category', cat.id)} className="p-1 text-slate-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Budgets;
