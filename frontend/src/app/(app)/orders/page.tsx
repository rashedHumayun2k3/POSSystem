"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { listOrders } from "@/lib/ordersApi";
import { useLanguage, type Lang } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/ui/StatusBadge";
import type { FulfillmentStatus, OrderListItem, OrderListItemSummary } from "@/types/orders";

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
  HAWKER: "🏪", // Night-entry sales display as Shop (দোকান) — same walk-in-style channel visually
  OTHER: "•",
};

type ChannelFilter = "" | "SHOP" | "ONLINE";

interface DateGroup {
  businessDate: string;
  orders: OrderListItem[];
  total: number;
  profit?: number; // undefined if any order in the group is missing profit (i.e. STAFF viewer)
}

// Orders already arrive sorted by BusinessDate desc (server-side), so a single pass groups
// consecutive same-date rows without needing to re-sort client-side.
function groupByBusinessDate(orders: OrderListItem[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const order of orders) {
    const last = groups[groups.length - 1];
    if (last && last.businessDate === order.businessDate) {
      last.orders.push(order);
      last.total += order.totalAmount;
      last.profit = last.profit === undefined || order.profit === undefined
        ? undefined
        : last.profit + order.profit;
    } else {
      groups.push({ businessDate: order.businessDate, orders: [order], total: order.totalAmount, profit: order.profit });
    }
  }
  return groups;
}

const MONTH_NAMES: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

function formatBusinessDate(dateStr: string, lang: Lang): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[lang][m - 1]} ${y}`;
}

// One fixed color per day of the week (Sun=0 .. Sat=6) — a quick visual cue for spotting
// weekly patterns (e.g. Friday/Saturday weekend sales) while scanning a long order history.
const WEEKDAY_STYLES = [
  { bg: "bg-rose-50",    border: "border-rose-100",    text: "text-rose-700",    icon: "text-rose-500" },    // Sunday
  { bg: "bg-indigo-50",  border: "border-indigo-100",  text: "text-indigo-700",  icon: "text-indigo-500" },  // Monday
  { bg: "bg-sky-50",     border: "border-sky-100",     text: "text-sky-700",     icon: "text-sky-500" },     // Tuesday
  { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700", icon: "text-emerald-500" }, // Wednesday
  { bg: "bg-amber-50",   border: "border-amber-100",   text: "text-amber-700",   icon: "text-amber-500" },   // Thursday
  { bg: "bg-fuchsia-50", border: "border-fuchsia-100", text: "text-fuchsia-700", icon: "text-fuchsia-500" }, // Friday
  { bg: "bg-orange-50",  border: "border-orange-100",  text: "text-orange-700",  icon: "text-orange-500" },  // Saturday
];

// getUTCDay (not getDay) — businessDate is a plain date string with no time component, so
// reading it in UTC avoids the weekday shifting based on the viewer's local timezone.
function weekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function weekdayStyle(dateStr: string) {
  return WEEKDAY_STYLES[weekdayIndex(dateStr)];
}

const DAY_NAMES: Record<Lang, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

function dayName(dateStr: string, lang: Lang): string {
  return DAY_NAMES[lang][weekdayIndex(dateStr)];
}

function itemsSummaryText(items: OrderListItemSummary[]): string {
  if (items.length === 0) return "";
  const first = items[0];
  const label = `${first.productName}${first.variantSku ? ` (${first.variantSku})` : ""}`;
  return items.length > 1 ? `${label} +${items.length - 1} more` : label;
}

export default function OrdersPage() {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  // Neither "Shop" nor "Online" is a single Channel value on the backend — Hawker night-entry
  // sales are walk-in/counter sales just like Shop, so "Shop" means SHOP+HAWKER and "Online" is
  // everything else. The list endpoint only filters on one exact Channel, so both tabs filter
  // client-side instead; "All" fetches unfiltered as normal.
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

  const visibleOrders =
    channelFilter === "SHOP"
      ? orders.filter((o) => o.channel === "SHOP" || o.channel === "HAWKER")
      : channelFilter === "ONLINE"
      ? orders.filter((o) => o.channel !== "SHOP" && o.channel !== "HAWKER")
      : orders;
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

      {/* Shop vs Online filter */}
      <div className="flex gap-1 px-3 pb-1 overflow-x-auto no-scrollbar">
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
                    {order.isDraft && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                        {t("orders.draft")}
                      </span>
                    )}
                  </div>

                  {/* The generic Walk-in/00000000000 placeholder (Shop/Hawker sales with no
                      customer picked) carries no information — hide it. A real customer
                      attached to a Shop sale (e.g. for baki tracking) still shows normally. */}
                  {order.customerPhone !== "00000000000" && (
                    <div className="text-sm text-gray-700 mb-1">
                      {order.customerName}{" "}
                      <span className="text-gray-400 text-xs">{order.customerPhone}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 items-center">
                    {/* Shop and Hawker sales are already-settled walk-in/counter cash sales —
                        FulfillmentStatus (always UNFULFILLED) and PaymentStatus (always PAID)
                        never carry any real information for these two channels, so they're just
                        noise here. Delivery channels (Facebook/WhatsApp/Instagram/Phone) actually
                        progress through real fulfillment states, so they still show both tags. */}
                    {order.channel !== "HAWKER" && order.channel !== "SHOP" && (
                      <StatusBadge status={order.fulfillmentStatus} />
                    )}
                    {order.channel !== "HAWKER" && order.channel !== "SHOP" && (
                      <StatusBadge status={order.paymentStatus} />
                    )}
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
