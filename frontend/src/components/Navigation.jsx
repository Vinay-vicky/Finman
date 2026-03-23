import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PieChart, Target, Moon, Sun, LogOut } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import './Navigation.css';

const Navigation = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { logout, user } = useContext(AuthContext);

  return (
    <nav className="glass-panel sidebar-nav">
      <div className="nav-brand">
        <h1>FinMan</h1>
        <span className="user-badge">Hi, {user?.username}</span>
      </div>
      
      <div className="nav-links">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard size={20} /> Dashboard
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <PieChart size={20} /> Analytics
        </NavLink>
        <NavLink to="/budgets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Target size={20} /> Budgets & Goals
        </NavLink>
      </div>

      <div className="nav-actions">
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle Light/Dark Mode">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={logout} className="logout-btn" title="Logout">
          <LogOut size={20} /> Logout
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
