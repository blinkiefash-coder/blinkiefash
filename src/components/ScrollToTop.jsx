import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const scrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll('.app-shell, .page, .hp, [data-scroll-root]').forEach((element) => {
        if (typeof element.scrollTop === 'number') element.scrollTop = 0;
      });
    };

    scrollTop();
    const animationFrame = requestAnimationFrame(scrollTop);
    const firstTimeout = setTimeout(scrollTop, 50);
    const secondTimeout = setTimeout(scrollTop, 200);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(firstTimeout);
      clearTimeout(secondTimeout);
    };
  }, [pathname, search]);

  return null;
}
