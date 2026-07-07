import { create } from "zustand";
import type { CheckoutResultDto } from "@/lib/types";

// Ephemeral, single-navigation-hop state — not persisted (unlike cartStore) since a checkout
// result only needs to survive the redirect from /checkout to /checkout/confirmation.
interface CheckoutResultState {
  result: CheckoutResultDto | null;
  setResult: (result: CheckoutResultDto) => void;
  clear: () => void;
}

export const useCheckoutResultStore = create<CheckoutResultState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  clear: () => set({ result: null }),
}));
