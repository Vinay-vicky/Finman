import React, { createContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser && isMounted) {
        setUser(JSON.parse(storedUser));
      }

      try {
        const refreshed = await apiRequest('/api/auth/refresh', { method: 'POST' });
        if (!isMounted) return;

        localStorage.setItem('token', refreshed.token);
        localStorage.setItem('user', JSON.stringify(refreshed.user));
        setToken(refreshed.token);
        setUser(refreshed.user);
      } catch {
        if (!isMounted) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = (userData, authToken) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore API logout errors and clear local session regardless.
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
