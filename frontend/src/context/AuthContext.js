import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from '@/lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
    } catch {
      tokenStore.clear();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    tokenStore.set(r.data.access_token);
    setToken(r.data.access_token);
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (email, password, name) => {
    const r = await api.post('/auth/register', { email, password, name });
    tokenStore.set(r.data.access_token);
    setToken(r.data.access_token);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
