import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PieChart, Target, FileText, Calculator, Shield, Rocket, Moon, Sun, LogOut } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

const Navigation = ({ onPrefetchRoute }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { logout, user } = useContext(AuthContext);

  const getNavLinkClass = ({ isActive }) => {
    return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
      isActive 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]' 
        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
    }`;
  };

  const prefetch = (key) => {
    if (onPrefetchRoute) onPrefetchRoute(key);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="glass-panel hidden md:flex flex-col w-64 sticky top-8 h-[calc(100vh-4rem)] p-5">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gradient mb-2 tracking-tight">FinMan</h1>
          <div className="inline-block bg-slate-800/80 border border-slate-700/50 rounded-full px-3 py-1 text-xs text-slate-300">
            Hi, {user?.username}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col gap-2">
          <NavLink to="/" className={getNavLinkClass} end onMouseEnter={() => prefetch('dashboard')} onFocus={() => prefetch('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/analytics" className={getNavLinkClass} onMouseEnter={() => prefetch('analytics')} onFocus={() => prefetch('analytics')}>
            <PieChart size={20} /> Analytics
          </NavLink>
          <NavLink to="/budgets" className={getNavLinkClass} onMouseEnter={() => prefetch('budgets')} onFocus={() => prefetch('budgets')}>
            <Target size={20} /> Budgets & Goals
          </NavLink>
          <NavLink to="/reports" className={getNavLinkClass} onMouseEnter={() => prefetch('reports')} onFocus={() => prefetch('reports')}>
            <FileText size={20} /> Reports
          </NavLink>
          <NavLink to="/calculators" className={getNavLinkClass} onMouseEnter={() => prefetch('calculators')} onFocus={() => prefetch('calculators')}>
            <Calculator size={20} /> Calculators
          </NavLink>
          <NavLink to="/settings" className={getNavLinkClass} onMouseEnter={() => prefetch('settings')} onFocus={() => prefetch('settings')}>
            <Shield size={20} /> Settings
          </NavLink>
          <NavLink to="/next-level" className={getNavLinkClass} onMouseEnter={() => prefetch('nextLevel')} onFocus={() => prefetch('nextLevel')}>
            <Rocket size={20} /> Next Level
          </NavLink>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-700/50 flex flex-col gap-2">
          {/* <button onClick={toggleTheme} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition-all font-medium w-full text-left">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />} 
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button> */}
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium w-full text-left">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="glass-panel md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-b-none border-b-0 border-x-0 !p-2 flex items-center justify-around h-16 pointer-events-auto">
        <NavLink to="/" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`} end>
          <LayoutDashboard size={22} className="mb-1" />
        </NavLink>
        <NavLink to="/analytics" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}>
          <PieChart size={22} className="mb-1" />
        </NavLink>
        <NavLink to="/budgets" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}>
          <Target size={22} className="mb-1" />
        </NavLink>
        <NavLink to="/reports" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}>
          <FileText size={22} className="mb-1" />
        </NavLink>
        <NavLink to="/calculators" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}>
          <Calculator size={22} className="mb-1" />
        </NavLink>
        <NavLink to="/settings" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}>
          <Shield size={22} className="mb-1" />
        </NavLink>
        <NavLink to="/next-level" className={({isActive}) => `p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}>
          <Rocket size={22} className="mb-1" />
        </NavLink>
        <button onClick={logout} className="p-3 rounded-xl text-slate-400 hover:text-red-400 transition-all">
          <LogOut size={22} className="mb-1" />
        </button>
      </nav>
    </>
  );
};

export default Navigation;
