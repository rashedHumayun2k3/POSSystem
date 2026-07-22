import { create } from "zustand";

interface ConnectivityState {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  isOnline: true,
  setOnline: (online) => {
    if (get().isOnline !== online) set({ isOnline: online });
  },
}));
