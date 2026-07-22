"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { listOrders } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import {
  groupByBusinessDate,
  formatBusinessDate,
  weekdayStyle,
  dayName,
  itemsSummaryText,
} from "@/lib/orderListHelpers";

const CHANNEL_ICONS: Record<string, string> = {
  FACEBOOK: "FB",
  WHATSAPP: "WA",
  INSTAGRAM: "IG",
  PHONE: "📞",
  SHOP: "🏪",
  HAWKER: "🏪",
  WEBSITE: "🌐",
  OTHER: "•",
};

type ChannelFilter = "" | "SHOP" | "ONLINE";

export default function SalesRecordPage() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  // A completed sale = money actually recorded as received (PaymentStatus PAID), not just
  // "Delivered" — a COD order can be Delivered while the courier is still holding the cash,
  // unremitted, which shouldn't count as revenue yet. RETURNED/CANCELLED are excluded
  // client-side as a safety net even though a processed return normally already flips
  // PaymentStatus away from PAID (to REFUNDED/PARTIALLY_PAID).
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-record", search, fromDate, toDate, currentBranchId],
    queryFn: () =>
      listOrders({
        paymentStatus: "PAID",
        q: search || undefined,
        from: fromDate || undefined,
        to: toDate ? `${toDate}T23:59:59` : undefined,
      }),
    staleTime: 15_000,
  });

  const completedOrders = orders.filter(
    (o) => o.fulfillmentStatus !== "RETURNED" && o.orderStatus !== "CANCELLED"
  );

  const visibleOrders =
    channelFilter === "SHOP"
      ? completedOrders.filter((o) => o.channel === "SHOP" || o.channel === "HAWKER")
      : channelFilter === "ONLINE"
      ? completedOrders.filter((o) => o.channel !== "SHOP" && o.channel !== "HAWKER")
      : completedOrders;
  const dateGroups = groupByBusinessDate(visibleOrders);

  const toggleDate = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold text-gray-900">{t("salesRecord.title")}</h1>
      </div>

      {/* Shop vs Online filter */}
      <div className="flex gap-1 px-3 pt-3 pb-1 overflow-x-auto no-scrollbar">
        {([
          { key: "", label: t("orders.channelAll") },
          { key: "SHOP", label: `🏪 ${t("orders.channelShop")}` },
          { key: "ONLINE", label: t("orders.channelOnline") },
        ] as { key: ChannelFilter; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setChannelFilter(tab.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              channelFilter === tab.key
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            {tab.label}
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

      {/* Search */}
      <div className="flex gap-2 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("orders.searchPlaceholder")}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-4">
        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.loading")}</div>
        )}
        {!isLoading && visibleOrders.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.noData")}</div>
        )}
        {dateGroups.map((group) => {
          const collapsed = collapsedDates.has(group.businessDate);
          const style = weekdayStyle(group.businessDate);
          return (
          <div key={group.businessDate} className={`rounded-xl border ${style.border} overflow-hidden`}>
            <button
              onClick={() => toggleDate(group.businessDate)}
              className={`w-full flex items-center justify-between px-4 py-3.5 ${style.bg} active:brightness-95 transition-all`}
            >
              <div className="flex items-center gap-2">
                <ChevronDownIcon
                  className={`w-5 h-5 ${style.icon} transition-transform ${collapsed ? "-rotate-90" : ""}`}
                />
                <div className="flex flex-col items-start leading-tight">
                  <span className={`text-base font-bold ${style.text}`}>
                    {formatBusinessDate(group.businessDate, lang)}
                  </span>
                  <span className={`text-xs font-medium opacity-70 ${style.text}`}>
                    {dayName(group.businessDate, lang)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end leading-tight">
                <span className={`text-sm font-bold ${style.text}`}>
                  {t("orders.dayTotal")}: ৳{group.total.toLocaleString()}
                </span>
                {group.profit !== undefined && (
                  <span className={`text-xs font-medium opacity-70 ${style.text}`}>
                    {t("orders.dayProfit")}: ৳{group.profit.toLocaleString()}
                  </span>
                )}
              </div>
            </button>

            {!collapsed && (
            <div className="divide-y divide-gray-100 bg-white">
              {group.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block p-3 active:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-900 truncate mr-2">
                      {itemsSummaryText(order.items)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                      ৳{order.totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-mono">{order.orderNo}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                      {CHANNEL_ICONS[order.channel] ?? order.channel}
                    </span>
                  </div>

                  {/* The generic Walk-in/00000000000 placeholder (Shop/Hawker sales with no
                      customer picked) carries no information — hide it. */}
                  {order.customerPhone !== "00000000000" && (
                    <div className="text-sm text-gray-700 mb-1">
                      {order.customerName}{" "}
                      <span className="text-gray-400 text-xs">{order.customerPhone}</span>
                    </div>
                  )}

                  {order.handlingUserName && (
                    <div className="text-xs text-gray-400 text-right">→ {order.handlingUserName}</div>
                  )}
                </Link>
              ))}
            </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
