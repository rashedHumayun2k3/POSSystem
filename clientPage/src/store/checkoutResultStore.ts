import { create } from "zustand";
import type { CheckoutResultDto } from "@/lib/types";
import type { CartItem } from "./cartStore";

// Ephemeral, single-navigation-hop state — not persisted (unlike cartStore) since a checkout
// result only needs to survive the redirect from /checkout to /checkout/confirmation.
interface CheckoutResultState {
  result: CheckoutResultDto | null;
  // Snapshotted from cartStore before it's cleared, so the confirmation page can prompt
  // "rate your purchase" per product without a round-trip to fetch order line items.
  purchasedItems: CartItem[];
  customerPhone: string | null;
  setResult: (result: CheckoutResultDto, purchasedItems: CartItem[], customerPhone: string) => void;
  clear: () => void;
}

export const useCheckoutResultStore = create<CheckoutResultState>((set) => ({
  result: null,
  purchasedItems: [],
  customerPhone: null,
  setResult: (result, purchasedItems, customerPhone) => set({ result, purchasedItems, customerPhone }),
  clear: () => set({ result: null, purchasedItems: [], customerPhone: null }),
}));
