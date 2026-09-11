import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProductById } from '../api';

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

function availableStock(item) {
  const value = item?.availableStock ?? item?.available_stock;
  return value === undefined || value === null || value === ''
    ? null
    : Math.max(0, Math.floor(Number(value)));
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
      const stock = availableStock(item) ?? availableStock(existing);
      if (stock === 0) return prev;
      const requestedQty = existing ? Number(existing.qty || 0) + addQty : addQty;
      const nextQty = stock == null ? requestedQty : Math.min(requestedQty, stock);
      if (existing) {
        return prev.map((i) =>
          itemKey(i) === key
            ? { ...i, qty: nextQty, availableStock: stock }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          productId: item.productId != null ? String(item.productId) : item.productId,
          variantId: item.variantId != null ? String(item.variantId) : item.variantId,
          qty: nextQty,
          price: Number(item.price) || 0,
          ...(stock == null ? {} : { availableStock: stock }),
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
        .map((i) => {
          if (itemKey(i) !== k) return i;
          const stock = availableStock(i);
          return { ...i, qty: stock == null ? nextQty : Math.min(nextQty, stock) };
        })
        .filter((i) => Number(i.qty) > 0)
    );
  }, []);

  const incrementQty = useCallback(async (item) => {
    const key = itemKey(item);
    if (!key || !item?.productId || !item?.variantId) return false;

    let product;
    try {
      product = await getProductById(item.productId);
    } catch {
      return false;
    }

    const variants = product?.variants || product?.product?.variants || [];
    const variant = variants.find(
      (candidate) => String(candidate.id || candidate.variant_id) === String(item.variantId)
    );
    const stock = variant?.available_stock;
    if (!variant || stock === undefined || stock === null) return false;

    let incremented = false;
    setItems((prev) =>
      prev.map((current) => {
        if (itemKey(current) !== key) return current;
        const nextQty = Number(current.qty || 0) + 1;
        const availableStock = Math.max(0, Math.floor(Number(stock)));
        if (nextQty > availableStock) return { ...current, availableStock };
        incremented = true;
        return { ...current, qty: nextQty, availableStock };
      })
    );
    return incremented;
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
      incrementQty,
      clearCart,
      isInCart,
      getCartQty,
      ...totals,
    }),
    [items, totals, addToCart, removeFromCart, updateQty, incrementQty, clearCart, isInCart, getCartQty]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}