import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'bfw_cart';

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => i && (i.productId || i.variantId))
    .map((i) => ({
      ...i,
      qty: Math.max(0, Number(i.qty) || 0),
      price: Number(i.price) || 0,
    }))
    .filter((i) => Number(i.qty) > 0);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return normalizeItems(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = (item) => {
    const key = item.variantId || item.productId;
    if (!key) return;
    const addQty = Math.max(1, Number(item.qty) || 1);

    setItems((prev) => {
      const existing = prev.find((i) => (i.variantId || i.productId) === key);
      if (existing) {
        return prev.map((i) =>
          (i.variantId || i.productId) === key
            ? { ...i, qty: Number(i.qty || 0) + addQty }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          qty: addQty,
          price: Number(item.price) || 0,
        },
      ];
    });
  };

  const removeFromCart = (key) => {
    setItems((prev) => prev.filter((i) => (i.variantId || i.productId) !== key));
  };

  const updateQty = (key, qty) => {
    const nextQty = Math.max(0, Number(qty) || 0);
    setItems((prev) =>
      prev
        .map((i) => ((i.variantId || i.productId) === key ? { ...i, qty: nextQty } : i))
        .filter((i) => Number(i.qty) > 0)
    );
  };

  const clearCart = () => setItems([]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0),
      0
    );
    const count = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    return { subtotal, count: Number(count) || 0 };
  }, [items]);

  const value = useMemo(
    () => ({ items, addToCart, removeFromCart, updateQty, clearCart, ...totals }),
    [items, totals]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}