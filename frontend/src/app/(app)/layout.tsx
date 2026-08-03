"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useConnectivityStore } from "@/store/connectivityStore";
import AppHeader from "@/components/layout/AppHeader";
import BottomTabBar from "@/components/layout/BottomTabBar";
import TrialBanner from "@/components/layout/TrialBanner";
import ConnectivityBanner from "@/components/layout/ConnectivityBanner";
import OfflineGate from "@/components/layout/OfflineGate";
import LiveNotificationsProvider from "@/components/layout/LiveNotificationsProvider";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";

// The only routes that render without needing a server round-trip: POS and Hawker Night Entry
// (the "New Sale" destination — Night Entry replaces POS entirely for hawker-channel businesses,
// see BottomTabBar's isHawker branch) both have their own offline-sale/local-cache path built for
// exactly this, and the FAQ is static content with no data fetching. Every other route — including
// the More menu itself, since almost everything it links to needs a server round-trip anyway —
// shows OfflineGate instead of mounting its content when offline, rather than letting each page's
// own query silently fail into a blank screen.
const OFFLINE_SAFE_PATHS = ["/pos", "/hawker/night-entry", "/more/faq"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  useEffect(() => {
    if (hasHydrated && !user) router.replace("/login");
  }, [hasHydrated, user, router]);
  if (!hasHydrated || !user) return null;

  const titleMap: Record<string, string> = {
    "/dashboard":        t("nav.home"),
    "/orders":           t("nav.orders"),
    "/sales-record":     t("nav.salesRecord"),
    "/products":         t("nav.products"),
    "/pos":              t("nav.pos"),
    "/hawker/night-entry": t("hawker.nightEntryTitle"),
    "/more":             t("nav.more"),
    "/more/purchases":   t("more.purchases"),
    "/more/categories":  t("more.categories"),
    "/more/expenses":    t("more.expenses"),
    "/more/deliveries":  t("more.deliveries"),
    "/more/baki":        t("more.baki"),
    "/more/reports":              t("more.reports"),
    "/more/reports/dashboard":   "Dashboard",
    "/more/reports/sales":       "Sales Reports",
    "/more/reports/inventory":   "Inventory Reports",
    "/more/reports/financial":   "Financial Reports",
    "/more/reports/orders":      "Order Reports",
    "/more/reports/stock-valuation": "Stock Valuation",
    "/more/settings":                    t("settings.title"),
    "/more/settings/staff":              t("settings.staff"),
    "/more/settings/couriers":           t("settings.couriers"),
    "/more/settings/expense-categories": t("settings.expenseCategories"),
    "/more/settings/config":             t("settings.businessConfig"),
    "/more/settings/branches":           t("settings.branches"),
    "/more/settings/subscription":       t("settings.subscription"),
    "/more/catalog-templates":           t("catalogTemplates.title"),
    "/notifications":    "🔔",
    "/profile":          t("profile.title"),
    "/onboarding/sales-channel": t("onboarding.title"),
    "/onboarding/business-type": t("onboarding.title"),
    "/onboarding/catalog":       t("catalogTemplates.title"),
  };

  const backHrefMap: Record<string, string> = {
    "/more/reports/dashboard": "/more/reports",
    "/more/reports/sales":     "/more/reports",
    "/more/reports/inventory": "/more/reports",
    "/more/reports/financial": "/more/reports",
    "/more/reports/orders":    "/more/reports",
    "/more/reports/stock-valuation": "/more/reports",
  };

  const title = titleMap[pathname] ?? "LavLokshan";
  const backHref = backHrefMap[pathname];

  // /orders/new and /orders/[id] render their own complete AppHeader (real title + edit/delete
  // actions) — the layout must not also render its default one, or the branch dropdown (and
  // everything else in AppHeader) shows twice, stacked.
  const hasOwnHeader = /^\/orders\/[^/]+$/.test(pathname);
  const isOfflineSafe = OFFLINE_SAFE_PATHS.includes(pathname);
  const showOfflineGate = !isOnline && !isOfflineSafe;

  return (
    <div className="max-w-[768px] mx-auto min-h-full bg-white shadow-sm flex flex-col min-h-screen">
      <div className="print:hidden">
        {!hasOwnHeader && <AppHeader title={title} backHref={backHref} />}
        {/* OfflineGate below already explains "no internet" full-screen on this same trigger —
            showing the banner too would just repeat it. The banner only earns its keep on pages
            where OfflineGate doesn't render (POS, Night Entry, More, FAQ). */}
        {!showOfflineGate && <ConnectivityBanner />}
        <TrialBanner />
      </div>
      <main className="flex-1 overflow-y-auto pb-20 print:pb-0 print:overflow-visible">
        {showOfflineGate ? <OfflineGate /> : children}
      </main>
      <div className="print:hidden">
        <BottomTabBar />
      </div>
      <LiveNotificationsProvider />
    </div>
  );
}
