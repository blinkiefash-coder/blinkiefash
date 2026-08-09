import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const WishlistContext = createContext(null);

const STORAGE_KEY = 'bfw_wishlist';

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const isWishlisted = (productId) => items.some((i) => i.productId === productId);

  const toggleWishlist = (item) => {
    setItems((prev) =>
      prev.some((i) => i.productId === item.productId)
        ? prev.filter((i) => i.productId !== item.productId)
        : [...prev, item]
    );
  };

  const removeFromWishlist = (productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const value = useMemo(
    () => ({ items, isWishlisted, toggleWishlist, removeFromWishlist }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
