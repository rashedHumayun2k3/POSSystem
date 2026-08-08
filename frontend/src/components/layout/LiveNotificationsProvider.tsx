"use client";

import { useLiveNotifications } from "@/hooks/useLiveNotifications";

// Establishes the SignalR connection (side effect only) — needs a session, so this only mounts
// in (app)/layout.tsx. Toast rendering itself lives in GlobalToast (root layout), since pre-auth
// pages like /login need toasts too but never establish a SignalR connection.
export default function LiveNotificationsProvider() {
  useLiveNotifications();
  return null;
}
