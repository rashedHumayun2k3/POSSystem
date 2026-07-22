"use client";

import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { useToastStore } from "@/store/toastStore";
import { Toast } from "@/components/ui/Toast";

// Establishes the SignalR connection (side effect only) and renders the single global toast —
// any page can trigger one via useToastStore().show(...) instead of a local error/success banner.
export default function LiveNotificationsProvider() {
  useLiveNotifications();
  const message = useToastStore((s) => s.message);
  const type = useToastStore((s) => s.type);
  const clear = useToastStore((s) => s.clear);
  if (!message) return null;
  return <Toast message={message} type={type} onClose={clear} />;
}
