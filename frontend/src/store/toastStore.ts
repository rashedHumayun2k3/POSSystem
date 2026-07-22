import { create } from "zustand";

interface ToastState {
  message: string | null;
  type: "success" | "error";
  show: (message: string, type?: "success" | "error") => void;
  clear: () => void;
}

// Single global toast, rendered once in the app layout (see GlobalToast) — any page can call
// show() instead of rendering its own local success/error banner. Positioning (bottom sheet on
// mobile, top banner on desktop) lives in the Toast component itself.
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: "success",
  show: (message, type = "success") => set({ message, type }),
  clear: () => set({ message: null }),
}));
