import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { apiRequest } from '../services/api';

const Login = ({ onSwitch }) => {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await apiRequest('/api/auth/google', {
        method: 'POST',
        body: { credential: credentialResponse.credential },
      });
      
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-panel w-full p-8 md:p-10">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Welcome Back</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm text-center">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
          <input 
            type="text" 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter your username"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <input 
            type="password" 
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />
        </div>
        
        <button 
          type="submit" 
          className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-500/20 transform hover:-translate-y-0.5 transition-all active:translate-y-0 mt-2"
        >
          Login
        </button>
      </form>
      
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-slate-700/50"></div>
        <span className="px-4 text-sm text-slate-500">Or continue with</span>
        <div className="flex-1 border-t border-slate-700/50"></div>
      </div>

      <div className="flex justify-center mb-6">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Login Failed')}
          theme="filled_black"
          shape="rectangular"
          text="signin_with"
        />
      </div>
      
      <div className="mt-6 text-center text-sm text-slate-400">
        Don't have an account?{' '}
        <button 
          onClick={onSwitch} 
          className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors focus:outline-none"
        >
          Sign up
        </button>
      </div>
    </div>
  );
};

export default Login;
