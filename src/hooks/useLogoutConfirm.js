import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Centralizes the confirm-then-logout flow so every logout entry point
 * (Navbar dropdown, Navbar mobile drawer, Account page) shares the same
 * open/cancel/confirm/loading state instead of re-implementing it.
 *
 * @param {Function} performLogout - whatever this call site needs to run to
 *   actually log the user out (clear localStorage, call AuthContext.logout, etc).
 *   Can be sync or return a Promise — both are awaited safely.
 * @param {string|null} redirectTo - path to navigate to after logout succeeds.
 *   Pass null to skip navigation (e.g. if the page already re-renders into a
 *   logged-out state on its own, like Account.jsx does).
 */
export function useLogoutConfirm(performLogout, redirectTo = '/login') {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const requestLogout = useCallback(() => setOpen(true), []);
  const cancel = useCallback(() => setOpen(false), []);

  const confirm = useCallback(async () => {
    setLoading(true);
    try {
      await performLogout();
      if (redirectTo) navigate(redirectTo);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }, [performLogout, redirectTo, navigate]);

  return { open, loading, requestLogout, cancel, confirm };
}