"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listOrders } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";
import StatusBadge from "@/components/ui/StatusBadge";
import type { FulfillmentStatus } from "@/types/orders";

const FULFILLMENT_TABS: Array<{ key: string; labelKey: string }> = [
  { key: "", labelKey: "orders.all" },
  { key: "UNFULFILLED", labelKey: "orders.open" },
  { key: "PACKED", labelKey: "orders.packed" },
  { key: "IN_TRANSIT", labelKey: "orders.inTransit" },
  { key: "DELIVERED", labelKey: "orders.delivered" },
  { key: "RETURNED", labelKey: "orders.returned" },
];

const CHANNEL_ICONS: Record<string, string> = {
  FACEBOOK: "FB",
  WHATSAPP: "WA",
  INSTAGRAM: "IG",
  PHONE: "📞",
  SHOP: "🏪",
  OTHER: "•",
};

export default function OrdersPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", activeTab, search],
    queryFn: () => listOrders({ fulfillmentStatus: activeTab || undefined, q: search || undefined }),
    staleTime: 15_000,
  });

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
      <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-2">
        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.loading")}</div>
        )}
        {!isLoading && orders.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.noData")}</div>
        )}
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="block bg-white rounded-xl shadow-sm border border-gray-100 p-3 active:bg-gray-50"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900">{order.orderNo}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                  {CHANNEL_ICONS[order.channel] ?? order.channel}
                </span>
                {order.isDraft && (
                  <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                    {t("orders.draft")}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900">৳{order.totalAmount.toLocaleString()}</span>
            </div>

            <div className="text-sm text-gray-700 mb-1">
              {order.customerName}{" "}
              <span className="text-gray-400 text-xs">{order.customerPhone}</span>
            </div>

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
            </div>

            <div className="text-xs text-gray-400 mt-1">
              {new Date(order.createdAt).toLocaleDateString("en-GB")}
              {order.trackingNo && (
                <span className="ml-2 text-indigo-600">{order.trackingNo}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
