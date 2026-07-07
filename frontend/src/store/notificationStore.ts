import { create } from "zustand";

// Live-only (no persistence) — matches the current scope decision: a toast + bell badge while
// staff are actively logged in, no notification history/read-state stored anywhere.
interface NotificationState {
  unreadCount: number;
  increment: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  reset: () => set({ unreadCount: 0 }),
}));
