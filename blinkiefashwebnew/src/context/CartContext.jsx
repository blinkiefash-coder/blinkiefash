import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'bfw_cart';

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => i && (i.productId || i.variantId))
    .map((i) => ({
      ...i,
      productId: i.productId != null ? String(i.productId) : i.productId,
      variantId: i.variantId != null ? String(i.variantId) : i.variantId,
      qty: Math.max(0, Number(i.qty) || 0),
      price: Number(i.price) || 0,
    }))
    .filter((i) => Number(i.qty) > 0);
}

function itemKey(item) {
  const v = item?.variantId ?? item?.productId;
  return v != null ? String(v) : null;
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

  const addToCart = useCallback((item) => {
    const key = itemKey(item);
    if (!key) return;
    const addQty = Math.max(1, Number(item.qty) || 1);

    setItems((prev) => {
      const existing = prev.find((i) => itemKey(i) === key);
      if (existing) {
        return prev.map((i) =>
          itemKey(i) === key
            ? { ...i, qty: Number(i.qty || 0) + addQty }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          productId: item.productId != null ? String(item.productId) : item.productId,
          variantId: item.variantId != null ? String(item.variantId) : item.variantId,
          qty: addQty,
          price: Number(item.price) || 0,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((key) => {
    const k = key != null ? String(key) : null;
    if (!k) return;
    setItems((prev) => prev.filter((i) => itemKey(i) !== k));
  }, []);

  const updateQty = useCallback((key, qty) => {
    const k = key != null ? String(key) : null;
    if (!k) return;
    const nextQty = Math.max(0, Number(qty) || 0);
    setItems((prev) =>
      prev
        .map((i) => (itemKey(i) === k ? { ...i, qty: nextQty } : i))
        .filter((i) => Number(i.qty) > 0)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const isInCart = useCallback(
    (productOrVariantId) => {
      if (productOrVariantId == null) return false;
      const k = String(productOrVariantId);
      return items.some((i) => itemKey(i) === k || String(i.productId) === k);
    },
    [items]
  );

  const getCartQty = useCallback(
    (productOrVariantId) => {
      if (productOrVariantId == null) return 0;
      const k = String(productOrVariantId);
      const found = items.find((i) => itemKey(i) === k || String(i.productId) === k);
      return found ? Number(found.qty) || 0 : 0;
    },
    [items]
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0),
      0
    );
    const count = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    return { subtotal, count: Number(count) || 0 };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      updateQty,
      clearCart,
      isInCart,
      getCartQty,
      ...totals,
    }),
    [items, totals, addToCart, removeFromCart, updateQty, clearCart, isInCart, getCartQty]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}