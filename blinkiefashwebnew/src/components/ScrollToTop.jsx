import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window (and common scroll containers) to the top on every route change.
 * Place inside <BrowserRouter>, as a sibling of <Routes> / <App />.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Immediate + deferred so it wins over layout/async content
    const scrollTop = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        // Common app scroll containers
        document.querySelectorAll(".app-shell, .page, .hp, [data-scroll-root]").forEach((el) => {
          if (el && typeof el.scrollTop === "number") el.scrollTop = 0;
        });
      } catch {
        /* ignore */
      }
    };

    scrollTop();
    const t1 = requestAnimationFrame(scrollTop);
    const t2 = setTimeout(scrollTop, 50);
    const t3 = setTimeout(scrollTop, 200);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, search]);

  return null;
}