import { createContext, useCallback, useContext, useRef, useState } from 'react';

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState('login'); // 'login' | 'signup'
  const onSuccessRef = useRef(null);

  // Call from anywhere: openAuthModal() or openAuthModal('signup')
  // Pass { onSuccess } to run something (retry add-to-cart, place order, etc.)
  // right after the person finishes logging in — no page navigation needed,
  // they just stay exactly where they were.
  const openAuthModal = useCallback((view = 'login', options = {}) => {
    setAuthModalView(view === 'signup' ? 'signup' : 'login');
    onSuccessRef.current = typeof options.onSuccess === 'function' ? options.onSuccess : null;
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    onSuccessRef.current = null;
  }, []);

  // Called internally by AuthModal once login/signup succeeds.
  const handleAuthSuccess = useCallback(() => {
    const cb = onSuccessRef.current;
    onSuccessRef.current = null;
    setIsAuthModalOpen(false);
    if (cb) cb();
  }, []);

  const value = {
    isAuthModalOpen,
    authModalView,
    setAuthModalView,
    openAuthModal,
    closeAuthModal,
    handleAuthSuccess,
  };

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

// hi

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}