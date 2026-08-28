import { create } from "zustand";

interface ClientPageAuthState {
  token: string | null;
  name: string | null;
  photoUrl: string | null;
  hasHydrated: boolean;
  login: (token: string, name: string, photoUrl: string | null) => void;
  logout: () => void;
}

const TOKEN_KEY = "cp_customer_token";
const NAME_KEY = "cp_customer_name";
const PHOTO_KEY = "cp_customer_photo";

export const useClientPageAuthStore = create<ClientPageAuthState>((set) => ({
  token: null,
  name: null,
  photoUrl: null,
  hasHydrated: false,
  login: (token, name, photoUrl) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(NAME_KEY, name);
      if (photoUrl) localStorage.setItem(PHOTO_KEY, photoUrl);
      else localStorage.removeItem(PHOTO_KEY);
    }
    set({ token, name, photoUrl });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(PHOTO_KEY);
    }
    set({ token: null, name: null, photoUrl: null });
  },
}));

export function hydrateClientPageAuth() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem(TOKEN_KEY);
  const name = localStorage.getItem(NAME_KEY);
  const photoUrl = localStorage.getItem(PHOTO_KEY);
  useClientPageAuthStore.setState({ token, name, photoUrl, hasHydrated: true });
}
