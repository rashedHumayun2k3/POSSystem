"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";

// Replaces a page's content entirely when offline and that route isn't one of the few that work
// without a server round-trip (POS/Night Entry, and the static More menu/FAQ). Without this, pages
// that fetch data with no isError handling just render nothing once their query fails — a blank
// screen with no explanation. This makes the same situation explicit everywhere at once, from one
// place, rather than patching every page's query individually.
export default function OfflineGate() {
  const { t } = useLanguage();

  // Same isHawker check BottomTabBar uses to decide the "New Sale" tab's destination — Night
  // Entry fully replaces POS for hawker-channel businesses, so linking to /pos for them isn't just
  // the wrong label, it's a route they never otherwise visit, which likely hasn't been
  // client-side-navigated to yet and so fails to load while offline.
  const businesses = useAuthStore((s) => s.businesses);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);
  const isHawker = businesses
    .find((b) => b.id === currentBusinessId)
    ?.salesChannels?.includes("HAWKER") ?? false;
  const sellHref = isHawker ? "/hawker/night-entry" : "/pos";
  const sellLabel = isHawker ? t("hawker.nightEntryTab") : t("connectivity.goToPos");

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-20 gap-4 min-h-[60vh]">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12v.01M15 9a4 4 0 00-6 0M2 2l20 20" />
        </svg>
      </div>
      <div>
        <p className="text-base font-semibold text-gray-900">{t("connectivity.gateTitle")}</p>
        <p className="text-sm text-gray-500 mt-1.5 max-w-xs mx-auto">{t("connectivity.gateBody")}</p>
      </div>
      <Link
        href={sellHref}
        className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-[0.98] transition"
      >
        {sellLabel}
      </Link>
    </div>
  );
}
