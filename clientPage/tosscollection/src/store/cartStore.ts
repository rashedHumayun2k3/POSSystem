import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variantId: string;
  productId: string;
  name: string;
  imageUrl?: string;
  price: number;
  variantValuesJson: string;
  qty: number;
  shopId: string;
  shopName: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  removeShop: (shopId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, qty = 1) => {
        const existing = get().items.find((i) => i.variantId === item.variantId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.variantId === item.variantId ? { ...i, qty: i.qty + qty } : i
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, qty }] });
        }
      },

      removeItem: (variantId) => {
        set({ items: get().items.filter((i) => i.variantId !== variantId) });
      },

      updateQty: (variantId, qty) => {
        if (qty <= 0) {
          get().removeItem(variantId);
          return;
        }
        set({ items: get().items.map((i) => (i.variantId === variantId ? { ...i, qty } : i)) });
      },

      removeShop: (shopId) => {
        set({ items: get().items.filter((i) => i.shopId !== shopId) });
      },

      clear: () => set({ items: [] }),
    }),
    { name: "cp_cart" }
  )
);

export function useCartCount() {
  return useCartStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0));
}

export function groupByShop(items: CartItem[]) {
  const groups = new Map<string, { shopId: string; shopName: string; items: CartItem[]; subtotal: number }>();
  for (const item of items) {
    if (!groups.has(item.shopId)) {
      groups.set(item.shopId, { shopId: item.shopId, shopName: item.shopName, items: [], subtotal: 0 });
    }
    const group = groups.get(item.shopId)!;
    group.items.push(item);
    group.subtotal += item.price * item.qty;
  }
  return [...groups.values()];
}
