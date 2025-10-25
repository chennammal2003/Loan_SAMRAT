import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface WishlistContextType {
  ids: string[];
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'wishlist_ids_v1';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  }, [ids]);

  const api = useMemo<WishlistContextType>(() => ({
    ids,
    toggle: (id: string) => setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])),
    add: (id: string) => setIds(prev => (prev.includes(id) ? prev : [...prev, id])),
    remove: (id: string) => setIds(prev => prev.filter(x => x !== id)),
    has: (id: string) => ids.includes(id),
  }), [ids]);

  return (
    <WishlistContext.Provider value={api}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}
