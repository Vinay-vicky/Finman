import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Target, Flag, Trash2, Plus } from 'lucide-react';

const Budgets = () => {
  const { token } = useContext(AuthContext);
  
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  // Forms limits
  const [bCategory, setBCategory] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [gName, setGName] = useState('');
  const [gTarget, setGTarget] = useState('');

  const fetchData = async () => {
    if (!token) return;
    try {
      const [bRes, gRes, cRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/budgets`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/goals`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics/charts/category`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (bRes.ok) setBudgets(await bRes.json());
      if (gRes.ok) setGoals(await gRes.json());
      
      if (cRes.ok) {
        const catData = await cRes.json();
        const catMap = {};
        catData.forEach(c => catMap[c.name] = c.value);
        setExpensesByCategory(catMap);
      }
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ category: bCategory, amount: Number(bAmount), month })
      });
      if (res.ok) {
        setBCategory(''); setBAmount('');
        fetchData();
      } else {
        alert(await res.text());
      }
    } catch (err) { }
  };

  const addGoal = async (e) => {
    e.preventDefault();
    if (!gName || !gTarget) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: gName, target_amount: Number(gTarget), current_amount: 0 })
      });
      if (res.ok) {
        setGName(''); setGTarget('');
        fetchData();
      }
    } catch (err) { }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm(`Delete ${type}?`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/${type}s/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center p-10 h-64">
      <h2 className="text-slate-400 animate-pulse text-lg">Loading targets...</h2>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="glass-panel p-6 shadow-none bg-transparent border-0 !p-0">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Budgets & Goals</h2>
        <p className="text-slate-400 text-sm">Set category limits and track your savings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* BUDGETS SETTINGS */}
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
              onChange={e => setBCategory(e.target.value)} 
              required 
            />
            <input 
              type="number" 
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm placeholder:text-slate-500 flex-[1]" 
              placeholder="Limit ₹" 
              value={bAmount} 
              onChange={e => setBAmount(e.target.value)} 
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
            ) : 
              budgets.map(b => {
                const spent = expensesByCategory[b.category] || 0;
                const percent = Math.min((spent / b.amount) * 100, 100);
                const isOver = spent > b.amount;
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
                    {isOver && <p className="text-xs text-red-400 mt-2 font-medium flex items-center gap-1"><Flag size={12}/> Budget exceeded</p>}
                  </div>
                )
              })
            }
          </div>
        </div>

        {/* SAVINGS GOALS */}
        <div className="glass-panel p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flag size={24} className="text-emerald-400" /> Savings Goals
          </h2>
          
          <form onSubmit={addGoal} className="flex gap-3 items-start bg-slate-900/30 p-4 rounded-xl border border-slate-700/30">
            <input 
              type="text" 
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm placeholder:text-slate-500 flex-[2]" 
              placeholder="Goal (e.g. Vacation)" 
              value={gName} 
              onChange={e => setGName(e.target.value)} 
              required 
            />
            <input 
              type="number" 
              className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm placeholder:text-slate-500 flex-[1]" 
              placeholder="Target ₹" 
              value={gTarget} 
              onChange={e => setGTarget(e.target.value)} 
              required 
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
            ) : 
              goals.map(g => {
                const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
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
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default Budgets;
