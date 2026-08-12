import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth as firebaseAuth } from '../firebase.js';
import { clearVendorPasswordAuth } from '../utils/vendorSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bfw_user')) || null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('bfw_token') || null);

  useEffect(() => {
    if (user) {
      localStorage.setItem('bfw_user', JSON.stringify(user));
      if (user.name) localStorage.setItem('userName', user.name);
      if (user.id !== undefined && user.id !== null) localStorage.setItem('userUuid', String(user.id));
    } else {
      localStorage.removeItem('bfw_user');
      localStorage.removeItem('userName');
      localStorage.removeItem('userUuid');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('bfw_token', token);
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('bfw_token');
      localStorage.removeItem('token');
    }
  }, [token]);

  const login = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
  };

  const logout = async () => {
    try {
      if (firebaseAuth?.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
    } catch {
      // ignore firebase logout failures and continue clearing local state
    }

    setUser(null);
    setToken(null);
    clearVendorPasswordAuth();
    localStorage.removeItem('vendor_id');
    localStorage.removeItem('vendor_store_id');
    localStorage.removeItem('store_name');
    localStorage.removeItem('vendor_name');
  };

  const value = useMemo(
    () => ({ user, token, isLoggedIn: !!user, login, logout }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
