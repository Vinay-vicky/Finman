import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

const Analytics = () => {
  const { token } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    // Fixed string interpolation
    Promise.all([
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics/summary`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics/charts/category`, { headers: { 'Authorization': `Bearer ${token}` } })
    ])
    .then(async ([res1, res2]) => {
      if (res1.ok) setSummary(await res1.json());
      if (res2.ok) setCategoryData(await res2.json());
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '3rem' }}><h2 style={{ color: 'var(--text-muted)' }}>Loading analytics...</h2></div>;
  if (!summary) return null;

  const barData = [
    { name: 'Income', amount: summary.income, fill: '#10b981' },
    { name: 'Expense', amount: summary.expense, fill: '#ef4444' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h2 style={{fontSize: '2rem', marginBottom: '0'}}>Analytics & Trends</h2>
      
      <div className="balance-cards">
        <div className="glass-panel balance-card">
          <div className="balance-title">Current Balance</div>
          <div className={`balance-amount ${summary.balance >= 0 ? 'amount-income' : 'amount-expense'}`}>
            ${summary.balance.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel balance-card">
          <div className="balance-title">Total Income</div>
          <div className="balance-amount amount-income">${summary.income.toFixed(2)}</div>
        </div>
        <div className="glass-panel balance-card">
          <div className="balance-title">Total Expenses</div>
          <div className="balance-amount amount-expense">${summary.expense.toFixed(2)}</div>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Expenses by Category</h3>
          {categoryData.length > 0 ? (
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={categoryData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={80} 
                    outerRadius={110} 
                    paddingAngle={5} 
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `$${value}`} 
                    contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No expense data to display.</p>
            </div>
          )}
        </div>
        
        <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Income vs Expense</h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  formatter={(value) => `$${value}`} 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                  contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={80} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
