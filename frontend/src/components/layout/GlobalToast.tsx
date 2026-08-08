"use client";

import { useToastStore } from "@/store/toastStore";
import { Toast } from "@/components/ui/Toast";

// Mounted once in the root layout so every route — including pre-auth pages like /login that
// never mount LiveNotificationsProvider (which needs a session for its SignalR connection) —
// can still show a toast via useToastStore().show(...).
export default function GlobalToast() {
  const message = useToastStore((s) => s.message);
  const type = useToastStore((s) => s.type);
  const clear = useToastStore((s) => s.clear);
  if (!message) return null;
  return <Toast message={message} type={type} onClose={clear} />;
}
