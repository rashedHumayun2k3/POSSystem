"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import AppHeader from "@/components/layout/AppHeader";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
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
    "/products":         t("nav.products"),
    "/pos":              t("nav.pos"),
    "/more":             t("nav.more"),
    "/more/purchases":   t("more.purchases"),
    "/more/categories":  t("more.categories"),
    "/more/expenses":    t("more.expenses"),
    "/more/deliveries":  t("more.deliveries"),
    "/more/baki":        t("more.baki"),
    "/more/reports":     t("more.reports"),
    "/more/settings":                    t("settings.title"),
    "/more/settings/staff":              t("settings.staff"),
    "/more/settings/couriers":           t("settings.couriers"),
    "/more/settings/expense-categories": t("settings.expenseCategories"),
    "/more/settings/config":             t("settings.businessConfig"),
    "/notifications":    "🔔",
  };

  const title = titleMap[pathname] ?? "Reseller Manager";

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title={title} />
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
