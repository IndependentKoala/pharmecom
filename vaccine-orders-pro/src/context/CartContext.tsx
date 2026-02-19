import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Product, DosePack } from '@/data/products';
import { API_BASE } from '@/lib/api';

export interface CartItem {
  product: Product;
  dosePack: DosePack;
  quantity: number;
  requestedDeliveryDate: string;
  specialInstructions?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, dosePack: DosePack, quantity: number, deliveryDate: string, specialInstructions?: string) => void;
  removeItem: (productId: string, dosePackId: number) => void;
  updateQuantity: (productId: string, dosePackId: number, quantity: number) => void;
  updateDeliveryDate: (productId: string, dosePackId: number, date: string) => void;
  updateSpecialInstructions: (productId: string, dosePackId: number, instructions: string) => void;
  clearCart: () => void;
  setUserIdAndClearCart: (id: string | null) => void;
  setServerCart: (items: any[]) => void;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const storedUserId = localStorage.getItem('userId') || null;
  const [userId, setUserId] = useState<string | null>(storedUserId);

  const loadCartFor = (id: string | null) => {
    try {
      if (id) {
        const raw = localStorage.getItem(`cart:${id}`);
        if (raw) return JSON.parse(raw) as CartItem[];
      }
      const anon = localStorage.getItem('cart:anon');
      if (anon) return JSON.parse(anon) as CartItem[];
    } catch (err) {
      // ignore parse errors
    }
    return [] as CartItem[];
  };

  const [items, setItems] = useState<CartItem[]>(() => loadCartFor(storedUserId));

  const addItem = useCallback((product: Product, dosePack: DosePack, quantity: number, deliveryDate: string, specialInstructions?: string) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && item.dosePack.id === dosePack.id
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          specialInstructions: specialInstructions || updated[existingIndex].specialInstructions,
        };
        return updated;
      }

      return [...prev, { product, dosePack, quantity, requestedDeliveryDate: deliveryDate, specialInstructions: specialInstructions || '' }];
    });
  }, []);

  const removeItem = useCallback((productId: string, dosePackId: number) => {
    setItems(prev => prev.filter(
      item => !(item.product.id === productId && item.dosePack.id === dosePackId)
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, dosePackId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, dosePackId);
      return;
    }

    setItems(prev => prev.map(item => 
      item.product.id === productId && item.dosePack.id === dosePackId
        ? { ...item, quantity }
        : item
    ));
  }, [removeItem]);

  const updateDeliveryDate = useCallback((productId: string, dosePackId: number, date: string) => {
    setItems(prev => prev.map(item =>
      item.product.id === productId && item.dosePack.id === dosePackId
        ? { ...item, requestedDeliveryDate: date }
        : item
    ));
  }, []);

  const updateSpecialInstructions = useCallback((productId: string, dosePackId: number, instructions: string) => {
    setItems(prev => prev.map(item =>
      item.product.id === productId && item.dosePack.id === dosePackId
        ? { ...item, specialInstructions: instructions }
        : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      if (userId) {
        localStorage.removeItem(`cart:${userId}`);
      }
      localStorage.removeItem('cart:anon');
    } catch (err) {
      // ignore
    }
  }, [userId]);

  const setServerCart = useCallback((serverItems: any[]) => {
    // Used when syncing server cart after login. Directly set items from server
    // without merging. Convert server format (dose_pack) to frontend format (dosePack).
    try {
      const converted = (serverItems || []).map((item: any) => {
        // Get delivery date or default to 3 days from now
        let deliveryDate = item.requested_delivery_date || item.requestedDeliveryDate;
        if (!deliveryDate) {
          const d = new Date();
          d.setDate(d.getDate() + 3);
          deliveryDate = d.toISOString().split('T')[0];
        }
        return {
          product: item.product,
          dosePack: item.dose_pack || item.dosePack,
          quantity: item.quantity,
          requestedDeliveryDate: deliveryDate,
          specialInstructions: item.special_instructions || item.specialInstructions || '',
        };
      });
      setItems(converted);
      localStorage.removeItem('cart:anon');
    } catch (err) {
      console.warn('Failed to convert server cart', err);
      // ignore
    }
  }, []);

  const setUserIdAndClearCart = useCallback((id: string | null) => {
    // When switching user, merge anonymous cart into user's cart without
    // persisting the anonymous cart into the user's storage first (which
    // could cause duplication). We delay calling `setUserId` until after
    // the merge so the effect that persists carts won't write the anon
    // cart into the user's key.
    try {
      if (id) {
        const userRaw = localStorage.getItem(`cart:${id}`);
        const anonRaw = localStorage.getItem('cart:anon');

        const userCart: CartItem[] = userRaw ? JSON.parse(userRaw) as CartItem[] : [];
        const anonCart: CartItem[] = anonRaw ? JSON.parse(anonRaw) as CartItem[] : items;

        const keyFor = (it: CartItem) => `${it.product.id}::${it.dosePack.id}`;
        const mergedMap = new Map<string, CartItem>();

        userCart.forEach(it => mergedMap.set(keyFor(it), it));
        anonCart.forEach(it => {
          const k = keyFor(it);
          if (mergedMap.has(k)) {
            const existing = mergedMap.get(k)!;
            mergedMap.set(k, { ...existing, quantity: existing.quantity + it.quantity });
          } else {
            mergedMap.set(k, it);
          }
        });

        const merged = Array.from(mergedMap.values());
        setItems(merged);
        // remove anonymous cart so merge only happens once
        localStorage.removeItem('cart:anon');
        // now set the active user id — effect will persist merged cart to `cart:${id}`
        setUserId(id);
        localStorage.setItem('userId', id);
      } else {
        // logging out: set userId to null and keep the current items as anonymous
        setUserId(null);
        localStorage.removeItem('userId');
        // effect will persist `items` to `cart:anon`
      }
    } catch (err) {
      // ignore storage errors
      setUserId(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Persist items to localStorage whenever they change
  useEffect(() => {
    try {
      if (userId) {
        localStorage.setItem(`cart:${userId}`, JSON.stringify(items));
      } else {
        localStorage.setItem('cart:anon', JSON.stringify(items));
      }
    } catch (err) {
      // ignore
    }
  }, [items, userId]);

  // Sync cart to server whenever items change and user is authenticated
  useEffect(() => {
    if (!userId) {
      return; // No sync for anonymous users
    }
    // Debounce: only sync if items have actually changed (not on every render)
    const syncTimer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          await fetch(`${API_BASE}/cart/`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Token ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({ items })
          });
        }
      } catch (err) {
        console.warn('Failed to sync cart to server', err);
      }
    }, 500); // Wait 500ms after last change before syncing
    return () => clearTimeout(syncTimer);
  }, [items, userId]);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      updateDeliveryDate,
      updateSpecialInstructions,
      clearCart,
      setUserIdAndClearCart,
      setServerCart,
      totalItems,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
