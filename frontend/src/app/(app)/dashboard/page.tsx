"use client";

import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import {
  PlusIcon,
  ShoppingCartIcon,
  TruckIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";

export default function DashboardPage() {
  const { user, isOwner } = useAuthStore();
  const owner = isOwner();
  const { t } = useLanguage();

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-500">{t("dashboard.welcomeBack")}</p>
        <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
      </div>

      {/* Money strip — owner only */}
      {owner && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {[
            { labelKey: "dashboard.cashToday",      value: "৳0", color: "bg-green-50 text-green-700" },
            { labelKey: "dashboard.customersOwe",   value: "৳0", color: "bg-blue-50 text-blue-700" },
            { labelKey: "dashboard.iOwe",           value: "৳0", color: "bg-red-50 text-red-700" },
            { labelKey: "dashboard.atCouriers",     value: "৳0", color: "bg-indigo-50 text-indigo-700" },
          ].map((card) => (
            <div
              key={card.labelKey}
              className={`flex-shrink-0 rounded-2xl px-4 py-3 min-w-[120px] ${card.color}`}
            >
              <p className="text-xs opacity-70">{t(card.labelKey)}</p>
              <p className="text-xl font-bold mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { labelKey: "dashboard.ordersToday",       value: "0", href: "/orders" },
          { labelKey: "dashboard.pendingDeliveries", value: "0", href: "/more/deliveries" },
          { labelKey: "dashboard.stockAlerts",       value: "0", href: "/products", danger: true },
        ].map((stat) => (
          <Link
            key={stat.labelKey}
            href={stat.href}
            className="bg-white rounded-2xl p-3 text-center border border-gray-100 active:scale-95 transition"
          >
            <p className={`text-2xl font-bold ${stat.danger ? "text-red-600" : "text-gray-900"}`}>
              {stat.value}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{t(stat.labelKey)}</p>
          </Link>
        ))}
      </div>

      {/* Monthly target — owner only */}
      {owner && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{t("dashboard.monthlyTarget")}</p>
            <p className="text-xs text-gray-400">0 / ৳0</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: "0%" }} />
          </div>
          <p className="text-xs text-gray-400">{t("dashboard.setTarget")}</p>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{t("dashboard.quickActions")}</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { labelKey: "dashboard.newOrder",    href: "/orders/new",          Icon: PlusIcon,            color: "bg-indigo-600 text-white" },
            { labelKey: "dashboard.posSale",     href: "/pos",                 Icon: ShoppingCartIcon,    color: "bg-green-600 text-white" },
            ...(owner
              ? [
                  { labelKey: "dashboard.newPurchase", href: "/more/purchases/new", Icon: TruckIcon,         color: "bg-amber-500 text-white" },
                  { labelKey: "dashboard.addExpense",  href: "/more/expenses/new",  Icon: CurrencyDollarIcon, color: "bg-red-500 text-white" },
                ]
              : []),
          ].map(({ labelKey, href, Icon, color }) => (
            <Link
              key={labelKey}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-4 h-14 font-semibold text-sm active:scale-95 transition ${color}`}
            >
              <Icon className="w-5 h-5" />
              {t(labelKey)}
            </Link>
          ))}
        </div>
      </div>

      {/* Attention list placeholder */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-amber-800">{t("dashboard.noAlerts")}</p>
        <p className="text-xs text-amber-600 mt-0.5">{t("dashboard.alertsDesc")}</p>
      </div>
    </div>
  );
}
