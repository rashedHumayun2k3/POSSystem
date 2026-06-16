"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Business } from "@/types/auth";

function authStoreDebug(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[auth-store] ${message}`, details ?? "");
  }
}

interface AuthState {
  user: User | null;
  businesses: Business[];
  currentBusinessId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setAuth: (user: User, businesses: Business[], access: string, refresh: string) => void;
  switchBusiness: (id: string) => void;
  logout: () => void;
  isOwner: () => boolean;
  isManager: () => boolean;
  isWarehouse: () => boolean;
  isStaff: () => boolean;
  canSeeCosts: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      businesses: [],
      currentBusinessId: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setAuth: (user, businesses, accessToken, refreshToken) => {
        const businessId = businesses[0]?.id ?? null;
        authStoreDebug("setAuth called", {
          userId: user.id,
          role: user.role,
          businessCount: businesses.length,
          businessId,
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
        });
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        if (businessId) localStorage.setItem("businessId", businessId);
        set({ user, businesses, currentBusinessId: businessId, accessToken, refreshToken });
      },

      switchBusiness: (id) => {
        localStorage.setItem("businessId", id);
        set({ currentBusinessId: id });
      },

      logout: () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("businessId");
        set({ user: null, businesses: [], currentBusinessId: null, accessToken: null, refreshToken: null });
      },

      isOwner:     () => get().user?.role === "OWNER",
      isManager:   () => get().user?.role === "MANAGER",
      isWarehouse: () => get().user?.role === "WAREHOUSE",
      isStaff:     () => get().user?.role === "STAFF",
      canSeeCosts: () => get().user?.role === "OWNER" || get().user?.role === "MANAGER",
    }),
    {
      name: "auth-storage",
      partialize: (s) => ({
        user: s.user,
        businesses: s.businesses,
        currentBusinessId: s.currentBusinessId,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        authStoreDebug("rehydrated", {
          hasUser: Boolean(state?.user),
          userId: state?.user?.id,
          businessId: state?.currentBusinessId,
          hasAccessToken: Boolean(state?.accessToken),
        });
        state?.setHasHydrated(true);
      },
    }
  )
);
