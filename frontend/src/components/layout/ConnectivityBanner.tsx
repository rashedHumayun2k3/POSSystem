"use client";

import Link from "next/link";
import { useConnectivityStore } from "@/store/connectivityStore";
import { useConnectivityWatcher } from "@/hooks/useConnectivityWatcher";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/i18n/LanguageContext";

export default function ConnectivityBanner() {
  useConnectivityWatcher();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const { t } = useLanguage();

  // Same isHawker check as OfflineGate/BottomTabBar — Night Entry replaces POS entirely for
  // hawker-channel businesses, so the link needs to follow suit.
  const businesses = useAuthStore((s) => s.businesses);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);
  const canAccessPos = useAuthStore((s) => s.user?.canAccessPos ?? false);
  const isHawker = businesses
    .find((b) => b.id === currentBusinessId)
    ?.salesChannels?.includes("HAWKER") ?? false;
  const sellHref = isHawker ? "/hawker/night-entry" : "/pos";
  const sellLabel = isHawker ? t("hawker.nightEntryTab") : t("connectivity.goToPos");

  if (isOnline) return null;

  return (
    <div className="bg-red-50 text-red-700">
      <div className="text-xs font-medium text-center px-4 py-2">
        {t(canAccessPos ? "connectivity.offline" : "connectivity.offlineNoPos")}
      </div>

      {canAccessPos && (
        <div className="text-center pb-2">
          <Link href={sellHref} className="text-xs font-semibold underline underline-offset-2">
            {sellLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
