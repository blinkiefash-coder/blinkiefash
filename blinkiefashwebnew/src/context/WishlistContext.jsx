import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const WishlistContext = createContext(null);

const STORAGE_KEY = 'bfw_wishlist';

function normalizeId(id) {
  return id != null ? String(id) : id;
}

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      return Array.isArray(raw)
        ? raw.map((i) => ({ ...i, productId: normalizeId(i.productId) }))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const isWishlisted = useCallback(
    (productId) => items.some((i) => String(i.productId) === String(productId)),
    [items]
  );

  const toggleWishlist = useCallback((item) => {
    if (!item?.productId && item?.productId !== 0) return;
    const pid = normalizeId(item.productId);
    setItems((prev) =>
      prev.some((i) => String(i.productId) === String(pid))
        ? prev.filter((i) => String(i.productId) !== String(pid))
        : [...prev, { ...item, productId: pid }]
    );
  }, []);

  const removeFromWishlist = useCallback((productId) => {
    const pid = normalizeId(productId);
    setItems((prev) => prev.filter((i) => String(i.productId) !== String(pid)));
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
    }),
    [items, isWishlisted, toggleWishlist, removeFromWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}