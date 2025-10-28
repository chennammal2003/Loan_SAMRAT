import React, { createContext, useContext, useMemo, useState } from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  qty: number;
};

type CartContextType = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add: CartContextType['add'] = (item, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
  };

  const remove: CartContextType['remove'] = (id) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const setQty: CartContextType['setQty'] = (id, qty) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, qty: Math.max(1, qty) } : p)));
  };

  const clear = () => setItems([]);

  const { count, subtotal } = useMemo(() => {
    const count = items.reduce((s, it) => s + it.qty, 0);
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    return { count, subtotal };
  }, [items]);

  return (
    <CartContext.Provider value={{ items, add, remove, setQty, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
