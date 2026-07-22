"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listOrders } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/ui/StatusBadge";
import { itemsSummaryText } from "@/lib/orderListHelpers";

// "New Orders" first and selected by default — for online-orders-only staff, that's the queue
// that matters most (see conversation: literal label beats status jargon like "Open" for
// less tech-savvy staff, and it's what they should land on without extra taps).
const FULFILLMENT_TABS: Array<{ key: string; labelKey: string }> = [
  { key: "UNFULFILLED", labelKey: "orders.newOrders" },
  { key: "PACKED", labelKey: "orders.packed" },
  { key: "IN_TRANSIT", labelKey: "orders.inTransit" },
  { key: "DELIVERED", labelKey: "orders.delivered" },
  { key: "RETURNED", labelKey: "orders.returned" },
  { key: "", labelKey: "orders.all" },
];

const CHANNEL_ICONS: Record<string, string> = {
  FACEBOOK: "FB",
  WHATSAPP: "WA",
  INSTAGRAM: "IG",
  PHONE: "📞",
  SHOP: "🏪",
  HAWKER: "🏪", // Night-entry sales display as Shop (দোকান) — same walk-in-style channel visually
  OTHER: "•",
};

export default function OrdersPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("UNFULFILLED");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  // This page is online-orders-only now — Shop/Hawker counter sales are instant, auto-confirmed,
  // auto-paid walk-in transactions (see PaymentModal.tsx / hawker/night-entry/page.tsx) that
  // never need this "still needs staff action" queue; they show up directly in Sales Record
  // instead. The list endpoint only filters on one exact Channel, so Shop/Hawker are excluded
  // client-side rather than via a toggle.
  // currentBranchId is in the key purely to force a refetch on branch switch — Order is
  // branch-scoped server-side already (via X-Branch-Id + EF's global query filter), but
  // React Query has no way to know that unless the key changes too (same pattern as
  // the Products list page).
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", activeTab, search, fromDate, toDate, currentBranchId],
    queryFn: () =>
      listOrders({
        fulfillmentStatus: activeTab || undefined,
        q: search || undefined,
        from: fromDate || undefined,
        // Backend does CreatedAt <= to, so a bare date would cut off that day's later orders.
        to: toDate ? `${toDate}T23:59:59` : undefined,
      }),
    staleTime: 15_000,
  });

  // Flat, newest-first — no date grouping here (that's Sales Record's job for daily revenue
  // totals). Orders is a "what needs my attention right now" queue; grouping by day just adds a
  // tap-to-expand step in front of the one thing staff actually came here to see. The list
  // endpoint already sorts BusinessDate/CreatedAt desc, so no client-side re-sort is needed.
  const visibleOrders = orders.filter((o) => o.channel !== "SHOP" && o.channel !== "HAWKER");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold text-gray-900">{t("orders.ordersList")}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-3 pb-1 overflow-x-auto no-scrollbar">
        {FULFILLMENT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 px-3 pb-1">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <span className="text-xs text-gray-400">{t("orders.dateRangeTo")}</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); }}
            className="text-xs text-indigo-500 shrink-0"
          >
            {t("common.clear")}
          </button>
        )}
      </div>

      {/* Search + New Order */}
      <div className="flex gap-2 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("orders.searchPlaceholder")}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <Link
          href="/orders/new"
          className="flex-shrink-0 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg"
        >
          + {t("orders.newOrder")}
        </Link>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-4">
        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.loading")}</div>
        )}
        {!isLoading && visibleOrders.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.noData")}</div>
        )}
        {!isLoading && visibleOrders.length > 0 && (
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100 bg-white">
            {visibleOrders.map((order) => {
              // Not-yet-packed orders (draft awaiting confirmation, or confirmed but unpacked):
              // FulfillmentStatus/PaymentStatus/due-amount are always the same three values for
              // every order in this state (UNFULFILLED/UNPAID/full amount due) — not information,
              // just noise. What actually helps decide confirm-vs-cancel is whether there's
              // enough stock, so that replaces the status badges here. Once an order moves past
              // this stage the badges become meaningful again and come back.
              const isNew = order.fulfillmentStatus === "UNFULFILLED";
              return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block p-3 active:bg-gray-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">{order.orderNo}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                    {CHANNEL_ICONS[order.channel] ?? order.channel}
                  </span>
                  {order.isDraft && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded">
                      {t("orders.newBadge")}
                    </span>
                  )}
                  {order.isRevised && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded">
                      🔄 {t("orders.revisedBadge")}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900 shrink-0 ml-auto">
                    ৳{order.totalAmount.toLocaleString()}
                  </span>
                </div>

                {/* Non-new orders (Packed/In Transit/Delivered/...) don't get the full per-item
                    breakdown below (status badges are the useful info at that stage), so this is
                    the only place product info shows for them — keep it there. New orders get
                    the full breakdown instead, so this line would just repeat it. */}
                {!isNew && (
                  <p className="font-semibold text-sm text-gray-900 truncate mb-1">
                    {itemsSummaryText(order.items)}
                  </p>
                )}

                {isNew ? (
                  <div className="space-y-0.5">
                    {order.items.map((item, idx) => {
                      const short = item.availableStock < item.qty;
                      return (
                        <p key={idx} className="text-xs truncate">
                          <span className="text-gray-700 font-medium">{item.productName}</span>{" "}
                          <span className={short ? "text-red-600 font-semibold" : "text-gray-500"}>
                            ({t("orders.qty")}: {item.qty} | {t("orders.stock")}: {item.availableStock})
                          </span>
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 items-center">
                    <StatusBadge status={order.fulfillmentStatus} />
                    <StatusBadge status={order.paymentStatus} />
                    {order.dueAmount > 0 && (
                      <span className="text-xs text-red-600 font-medium">
                        বাকি ৳{order.dueAmount.toLocaleString()}
                      </span>
                    )}
                    {order.handlingUserName && (
                      <span className="text-xs text-gray-400 ml-auto">
                        → {order.handlingUserName}
                      </span>
                    )}
                    {order.trackingNo && (
                      <span className="text-xs text-indigo-600">{order.trackingNo}</span>
                    )}
                  </div>
                )}
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
