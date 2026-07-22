"use client";

import { useConnectivityStore } from "@/store/connectivityStore";
import { useConnectivityWatcher } from "@/hooks/useConnectivityWatcher";
import { useLanguage } from "@/i18n/LanguageContext";

export default function ConnectivityBanner() {
  useConnectivityWatcher();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const { t } = useLanguage();

  if (isOnline) return null;

  return (
    <div className="bg-red-50 text-red-700 text-xs font-medium text-center px-4 py-2">
      {t("connectivity.offline")}
    </div>
  );
}
