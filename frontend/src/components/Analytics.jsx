import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { apiRequest } from '../services/api';

const COLORS = ['#34d399', '#3b82f6', '#f87171', '#fbbf24', '#a78bfa', '#f472b6'];

const Analytics = () => {
  const { token } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    Promise.all([
      apiRequest('/api/analytics/summary', { token }),
      apiRequest('/api/analytics/charts/category', { token })
    ])
    .then(([summaryData, categoryChartData]) => {
      // Ensure summary has numeric values
      const processedSummary = {
        income: Number(summaryData.income) || 0,
        expense: Number(summaryData.expense) || 0,
        balance: Number(summaryData.balance) || 0
      };
      
      // Ensure category data is an array with numeric values
      const processedCategories = Array.isArray(categoryChartData) 
        ? categoryChartData.map(cat => ({
            ...cat,
            value: Number(cat.value) || 0
          }))
        : [];
      
      setSummary(processedSummary);
      setCategoryData(processedCategories);
    })
    .catch(err => {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'Failed to load analytics');
    })
    .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 h-64">
        <h2 className="text-slate-400 animate-pulse text-lg">Loading analytics...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 bg-red-500/10 border-red-500/30">
        <h3 className="text-red-400 font-semibold mb-2">⚠️ Error Loading Analytics</h3>
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }
  
  if (!summary) {
    return (
      <div className="glass-panel p-6 bg-yellow-500/10 border-yellow-500/30">
        <h3 className="text-yellow-400 font-semibold mb-2">No Data Available</h3>
        <p className="text-yellow-300 text-sm">Add some transactions to see your analytics.</p>
      </div>
    );
  }

  const barData = [
    { name: 'Income', amount: summary.income, fill: '#34d399' },
    { name: 'Expense', amount: summary.expense, fill: '#f87171' }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="glass-panel shadow-none bg-transparent border-0 !p-0">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Analytics & Trends</h2>
        <p className="text-slate-400 text-sm">Visual breakdown of your financial health</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 relative overflow-hidden">
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Current Balance</p>
          <div className={`text-4xl font-extrabold ${summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{summary.balance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="glass-panel p-6 relative overflow-hidden">
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Income</p>
          <div className="text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
            ₹{summary.income.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="glass-panel p-6 relative overflow-hidden">
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Expenses</p>
          <div className="text-4xl font-extrabold text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.3)]">
            ₹{summary.expense.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Expenses by Category</h3>
          {categoryData.length > 0 ? (
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={categoryData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={80} 
                    outerRadius={120} 
                    paddingAngle={5} 
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `₹${value}`} 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border border-slate-700/50 rounded-xl border-dashed">
              <p className="text-slate-500">No expense data to display.</p>
            </div>
          )}
        </div>
        
        <div className="glass-panel p-6 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Income vs Expense</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  formatter={(value) => `₹${value}`} 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={80}>
                   {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
