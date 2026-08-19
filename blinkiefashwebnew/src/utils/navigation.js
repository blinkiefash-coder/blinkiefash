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
    // history.length > 1 usually means there is something to go back to.
    // Still imperfect for deep links opened in a new tab, so fallback is important.
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
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
