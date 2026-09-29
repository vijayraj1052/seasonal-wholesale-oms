import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { CartItem } from '@/types/database';

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, unitId: string) => void;
  updateQuantity: (productId: string, unitId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product_id === item.product_id && i.unit_id === item.unit_id
      );
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id && i.unit_id === item.unit_id
            ? { ...i, requested_quantity: i.requested_quantity + item.requested_quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((productId: string, unitId: string) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.product_id === productId && i.unit_id === unitId)
      )
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, unitId: string, qty: number) => {
      if (qty <= 0) {
        setItems((prev) =>
          prev.filter(
            (i) => !(i.product_id === productId && i.unit_id === unitId)
          )
        );
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.product_id === productId && i.unit_id === unitId
            ? { ...i, requested_quantity: qty }
            : i
        )
      );
    },
    []
  );

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.requested_quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  return useContext(CartContext);
}
