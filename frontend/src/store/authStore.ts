"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Business, SalesChannel } from "@/types/auth";
import type { Branch } from "@/types/branch";

function authStoreDebug(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[auth-store] ${message}`, details ?? "");
  }
}

interface AuthState {
  user: User | null;
  businesses: Business[];
  currentBusinessId: string | null;
  branches: Branch[];
  currentBranchId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setAuth: (user: User, businesses: Business[], access: string, refresh: string) => void;
  updateUserPhoto: (photoUrl: string | null) => void;
  updateCurrentBusinessSalesChannels: (salesChannels: SalesChannel[]) => void;
  switchBusiness: (id: string) => void;
  setBranches: (branches: Branch[]) => void;
  switchBranch: (id: string) => void;
  clearBranch: () => void;
  logout: () => void;
  isOwner: () => boolean;
  isManager: () => boolean;
  isWarehouse: () => boolean;
  isStaff: () => boolean;
  canSeeCosts: () => boolean;
  canAccessAllBranches: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      businesses: [],
      currentBusinessId: null,
      branches: [],
      currentBranchId: null,
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
        localStorage.removeItem("branchId");
        set({ user, businesses, currentBusinessId: businessId, branches: [], currentBranchId: null, accessToken, refreshToken });
      },

      updateUserPhoto: (photoUrl) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, photoUrl } });
      },

      updateCurrentBusinessSalesChannels: (salesChannels) => {
        const { businesses, currentBusinessId } = get();
        set({
          businesses: businesses.map((b) =>
            b.id === currentBusinessId ? { ...b, salesChannels } : b
          ),
        });
      },

      switchBusiness: (id) => {
        localStorage.setItem("businessId", id);
        localStorage.removeItem("branchId");
        set({ currentBusinessId: id, branches: [], currentBranchId: null });
      },

      setBranches: (branches) => set({ branches }),

      switchBranch: (id) => {
        localStorage.setItem("branchId", id);
        set({ currentBranchId: id });
      },

      // OWNER/MANAGER "All Branches" mode — clears the active branch header entirely.
      clearBranch: () => {
        localStorage.removeItem("branchId");
        set({ currentBranchId: null });
      },

      logout: () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("businessId");
        localStorage.removeItem("branchId");
        set({ user: null, businesses: [], currentBusinessId: null, branches: [], currentBranchId: null, accessToken: null, refreshToken: null });
      },

      isOwner:     () => get().user?.role === "OWNER",
      isManager:   () => get().user?.role === "MANAGER",
      isWarehouse: () => get().user?.role === "WAREHOUSE",
      isStaff:     () => get().user?.role === "STAFF",
      canSeeCosts: () => get().user?.role === "OWNER" || get().user?.role === "MANAGER",
      canAccessAllBranches: () => ["OWNER", "MANAGER", "PARTNER"].includes(get().user?.role ?? ""),
    }),
    {
      name: "auth-storage",
      partialize: (s) => ({
        user: s.user,
        businesses: s.businesses,
        currentBusinessId: s.currentBusinessId,
        branches: s.branches,
        currentBranchId: s.currentBranchId,
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
