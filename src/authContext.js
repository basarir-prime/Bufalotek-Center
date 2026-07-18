import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscribeAuth, getUserRole } from './firestoreService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsub = subscribeAuth(async (u) => {
      setLoading(true);
      setAuthError('');
      if (u) {
        setUser(u);
        try {
          const r = await getUserRole(u);
          setRole(r);
        } catch (e) {
          setAuthError('Rol bilgisi okunamadı: ' + (e?.message || ''));
          setRole('user');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetAuthError = useCallback(() => setAuthError(''), []);

  return (
    <AuthContext.Provider value={{ user, role, loading, authError, resetAuthError, isAdmin: role === 'admin', setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
