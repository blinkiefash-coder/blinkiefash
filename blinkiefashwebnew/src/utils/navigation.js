import { useNavigate } from "react-router-dom";

/**
 * Safe back navigation for SPAs.
 * Uses browser history when available; otherwise navigates to a fallback route.
 *
 * Usage:
 *   const goBack = useSmartBack("/shop");
 *   <button onClick={goBack}>Back</button>
 */
export function useSmartBack(fallback = "/") {
  const navigate = useNavigate();

  return () => {
    try {
      // Prefer real history entry when user actually navigated within the app
      const idx = window.history.state?.idx;
      if (typeof idx === "number" && idx > 0) {
        navigate(-1);
        return;
      }
      // Fallback: if referrer is same origin, try back; else go to fallback
      const ref = document.referrer || "";
      const sameOrigin = ref.startsWith(window.location.origin);
      if (sameOrigin && window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch {
      /* ignore */
    }
    navigate(fallback || "/", { replace: true });
  };
}

/**
 * Prefer this over window.location.href for internal routes so the SPA
 * history stack stays intact and React context state is preserved.
 */
export function useAppNavigate() {
  const navigate = useNavigate();

  return (to, options = {}) => {
    if (typeof to === "number") {
      navigate(to);
      return;
    }
    navigate(to, options);
  };
}