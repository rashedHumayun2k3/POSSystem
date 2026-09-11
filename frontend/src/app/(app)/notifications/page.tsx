"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listOrders } from "@/lib/ordersApi";
import { useLanguage, type Lang } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";

function timeAgo(iso: string, lang: Lang): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return lang === "bn" ? "এইমাত্র" : "just now";
  if (minutes < 60) return lang === "bn" ? `${minutes} মিনিট আগে` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "bn" ? `${hours} ঘণ্টা আগে` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === "bn" ? `${days} দিন আগে` : `${days}d ago`;
}

const BellIcon = () => (
  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  // Not a notification log — just "which online orders still need staff to start processing
  // them" (FulfillmentStatus stays UNFULFILLED until someone packs it), re-checked on load.
  // Storefront orders are auto-confirmed the moment they're placed (see
  // ClientPageCheckoutService → OrderService.CreateAsync's auto-confirm), so packing — not a
  // separate "confirm" step — is what makes an entry here disappear.
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["notifications-online-orders", currentBranchId],
    queryFn: () => listOrders({ channel: "WEBSITE", fulfillmentStatus: "UNFULFILLED" }),
    staleTime: 15_000,
  });

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400 text-sm">{t("common.loading")}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <BellIcon />
        <p className="text-sm">{t("notifications.empty")}</p>
      </div>
    );
  }

  const MAX_ITEMS_SHOWN = 4;

  return (
    <div className="p-3 space-y-2">
      {orders.map((order) => {
        const shownItems = order.items.slice(0, MAX_ITEMS_SHOWN);
        const extraCount = order.items.length - shownItems.length;
        return (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="block bg-green-50 border border-green-200 rounded-2xl p-3.5 active:scale-[0.99] transition"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-green-800">
                {t("notifications.orderNo")}: {order.orderNo}
              </span>
              <span className="text-[11px] text-green-600 shrink-0">{timeAgo(order.createdAt, lang)}</span>
            </div>
            <div className="space-y-0.5 mb-1.5">
              {shownItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs text-green-700">
                  <span className="truncate">
                    {item.productName}
                    {item.variantSku ? ` (${item.variantSku})` : ""}
                  </span>
                  <span className="shrink-0 font-medium">{item.qty}</span>
                </div>
              ))}
              {extraCount > 0 && (
                <p className="text-xs text-green-500">{t("notifications.moreItems", { n: extraCount })}</p>
              )}
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-green-200/60">
              <span className="text-xs font-semibold text-green-800">{t("notifications.totalOrderValue")}</span>
              <span className="text-sm font-bold text-green-900">৳{order.totalAmount.toLocaleString()}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
