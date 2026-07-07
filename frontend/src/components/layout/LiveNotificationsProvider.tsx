"use client";

import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { Toast } from "@/components/ui/Toast";

export default function LiveNotificationsProvider() {
  const { toastMessage, clearToast } = useLiveNotifications();
  if (!toastMessage) return null;
  return <Toast message={toastMessage} type="success" onClose={clearToast} />;
}
