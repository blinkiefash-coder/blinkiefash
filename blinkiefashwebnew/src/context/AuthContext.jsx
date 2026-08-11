import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth as firebaseAuth } from '../firebase.js';

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
    if (user) localStorage.setItem('bfw_user', JSON.stringify(user));
    else localStorage.removeItem('bfw_user');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('bfw_token', token);
    else localStorage.removeItem('bfw_token');
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
