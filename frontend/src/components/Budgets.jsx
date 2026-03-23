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
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    
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

  if (loading) return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      {/* BUDGETS SETTINGS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-panel">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Target size={24} color="var(--primary)" /> Monthly Budgets
          </h2>
          
          <form onSubmit={addBudget} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input type="text" className="form-control" placeholder="Category (e.g. Food)" value={bCategory} onChange={e => setBCategory(e.target.value)} style={{ flex: 2 }} required />
            <input type="number" className="form-control" placeholder="Limit" value={bAmount} onChange={e => setBAmount(e.target.value)} style={{ flex: 1 }} required />
            <button type="submit" className="btn" style={{ width: 'auto', padding: '0 1rem' }}><Plus size={20} /></button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {budgets.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No budgets set.</p> : 
              budgets.map(b => {
                const spent = expensesByCategory[b.category] || 0;
                const percent = Math.min((spent / b.amount) * 100, 100);
                const isOver = spent > b.amount;
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{b.category}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <span style={{ color: isOver ? 'var(--danger)' : 'var(--text-main)' }}>${spent.toFixed(2)}</span> / ${b.amount}
                        <Trash2 size={14} style={{ marginLeft: '1rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => deleteItem('budget', b.id)} />
                      </span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percent}%`, 
                        background: isOver ? 'var(--danger)' : 'var(--primary)',
                        transition: 'width 0.5s ease-out'
                      }}></div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      {/* SAVINGS GOALS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-panel">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Flag size={24} color="var(--success)" /> Savings Goals
          </h2>
          
          <form onSubmit={addGoal} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input type="text" className="form-control" placeholder="Goal (e.g. New Car)" value={gName} onChange={e => setGName(e.target.value)} style={{ flex: 2 }} required />
            <input type="number" className="form-control" placeholder="Target" value={gTarget} onChange={e => setGTarget(e.target.value)} style={{ flex: 1 }} required />
            <button type="submit" className="btn" style={{ width: 'auto', padding: '0 1rem' }}><Plus size={20} /></button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {goals.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No goals set.</p> : 
              goals.map(g => {
                const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
                return (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        ${g.current_amount} / ${g.target_amount}
                        <Trash2 size={14} style={{ marginLeft: '1rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => deleteItem('goal', g.id)} />
                      </span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percent}%`, 
                        background: 'var(--success)',
                        transition: 'width 0.5s ease-out'
                      }}></div>
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
