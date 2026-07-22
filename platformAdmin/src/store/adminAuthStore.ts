import { create } from "zustand";

interface AdminAuthState {
  token: string | null;
  hasHydrated: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const STORAGE_KEY = "platformAdminToken";

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: null,
  hasHydrated: false,
  setToken: (token: string) => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, token);
    set({ token });
  },
  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    set({ token: null });
  },
}));

export function hydrateAdminAuth() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem(STORAGE_KEY);
  useAdminAuthStore.setState({ token, hasHydrated: true });
}
