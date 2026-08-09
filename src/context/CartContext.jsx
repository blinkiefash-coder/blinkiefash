import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'bfw_cart';

export function CartProvider({ children }) {
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

  const addToCart = (item) => {
    setItems((prev) => {
      const key = item.variantId || item.productId;
      const existing = prev.find((i) => (i.variantId || i.productId) === key);
      if (existing) {
        return prev.map((i) =>
          (i.variantId || i.productId) === key ? { ...i, qty: i.qty + (item.qty || 1) } : i
        );
      }
      return [...prev, { ...item, qty: item.qty || 1 }];
    });
  };

  const removeFromCart = (key) => {
    setItems((prev) => prev.filter((i) => (i.variantId || i.productId) !== key));
  };

  const updateQty = (key, qty) => {
    setItems((prev) =>
      prev
        .map((i) => ((i.variantId || i.productId) === key ? { ...i, qty } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const clearCart = () => setItems([]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return { subtotal, count };
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
