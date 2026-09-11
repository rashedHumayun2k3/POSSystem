"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { listOrders } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/ui/StatusBadge";
import { OrderProcessGuide } from "@/components/orders/OrderProgress";
import { itemsSummaryText } from "@/lib/orderListHelpers";
// Same date-range convention already used across Reports (DateRangeBar) — reused here instead of
// inventing a parallel "last 7/30 days" concept just for this page.
import { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod } from "@/types/reports";

// Tabs ordered by lifecycle step, not raw FulfillmentStatus — UNFULFILLED alone actually covers
// two different states that need two different actions (a still-draft order needing a Confirm/
// Cancel decision vs an already-confirmed one just waiting to be packed/handed over), so that one
// status is split into two virtual tabs by IsDraft instead of shown as a single mixed bucket.
// "New Orders" stays first/default — for online-orders-only staff, that's the queue that matters
// most (literal label beats status jargon like "Open" for less tech-savvy staff, and it's what
// they should land on without extra taps).
// "Pending Deliveries" means pending delivery TO THE CUSTOMER — handed to a courier, en route,
// not yet arrived. So it maps to exactly FulfillmentStatus=IN_TRANSIT, same definition the
// Dashboard's "Pending deliveries" tile uses (ReportService.GetHomeSummaryAsync), so tapping that
// tile lands on a list that actually totals the number shown. A confirmed order still sitting in
// the warehouse (not yet handed to courier) belongs in "Waiting for Courier" instead — it isn't
// "pending delivery" yet, it's pending shipment.
const WAITING_COURIER_STATUSES = ["UNFULFILLED", "PACKED"];
const FULFILLMENT_TABS: Array<{ key: string; labelKey: string }> = [
  { key: "UNFULFILLED", labelKey: "orders.newOrders" },
  { key: "WAITING_COURIER", labelKey: "orders.waitingForCourier" },
  // Same underlying data as the old standalone "In Transit" tab — kept as this one instead of
  // both, since a separate "পথে আছে" tab right next to "পেন্ডিং ডেলিভারি" (once that also meant
  // IN_TRANSIT) would just be two tabs for the same thing.
  { key: "PENDING", labelKey: "dashboard.pendingDeliveries" },
  { key: "DELIVERED", labelKey: "orders.delivered" },
  { key: "RETURNED", labelKey: "orders.returned" },
  // Not a FulfillmentStatus — Cancel doesn't touch FulfillmentStatus/IsDraft (see
  // OrderService.CancelAsync), so a cancelled order otherwise keeps showing up under whatever
  // fulfillment tab it was in when cancelled (e.g. still "New Orders" if it was never packed).
  // This tab filters on OrderStatus=CANCELLED instead, and every other tab below explicitly
  // excludes cancelled orders so they don't linger in active queues.
  { key: "CANCELLED", labelKey: "status.CANCELLED" },
  { key: "", labelKey: "orders.all" },
];

const CHANNEL_ICONS: Record<string, string> = {
  FACEBOOK: "FB",
  WHATSAPP: "WA",
  INSTAGRAM: "IG",
  PHONE: "📞",
  SHOP: "🏪",
  HAWKER: "🏪", // Night-entry sales display as Shop (দোকান) — same walk-in-style channel visually
  MYWEBSITE: "🌐",
  OTHER: "•",
};

function orderGroupDateLabel(businessDate: string, t: (key: string) => string): string {
  const d = new Date(businessDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("orders.today");
  if (d.toDateString() === yesterday.toDateString()) return t("orders.yesterday");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageInner />
    </Suspense>
  );
}

function OrdersPageInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  // Lazy init so a deep-link like /orders?tab=PENDING (from the Dashboard tile) lands directly on
  // that tab instead of always opening on the UNFULFILLED default and requiring an extra tap.
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "UNFULFILLED");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // Which named preset (if any) produced the current from/to — drives both the "selected" state
  // of the preset buttons when the sheet is reopened, and the short label shown on the filter
  // icon itself (e.g. "7D"). Manually editing either date input clears it, since the range no
  // longer necessarily matches a named preset.
  const [activePeriod, setActivePeriod] = useState<ReportPeriod | null>(null);
  const [customerFilter, setCustomerFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  const applyDatePeriod = (period: ReportPeriod) => {
    const { from, to } = periodToDates(period);
    setFromDate(from);
    setToDate(to);
    setActivePeriod(period);
  };

  const clearAllFilters = () => {
    setFromDate("");
    setToDate("");
    setActivePeriod(null);
    setCustomerFilter("");
    setProductFilter("");
  };

  const periodLabel = (period: ReportPeriod) => (period === "today" ? t("orders.today") : period.toUpperCase());

  const hasAnyFilter = Boolean(activePeriod || fromDate || toDate || customerFilter || productFilter);

  // Removable chip per active filter, shown below the search row so the current filter state is
  // visible at a glance without reopening the sheet — and each one is independently clearable.
  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (activePeriod) {
    activeFilterChips.push({
      key: "period",
      label: periodLabel(activePeriod),
      onRemove: () => { setFromDate(""); setToDate(""); setActivePeriod(null); },
    });
  } else if (fromDate || toDate) {
    activeFilterChips.push({
      key: "custom",
      label: t("orders.customRange"),
      onRemove: () => { setFromDate(""); setToDate(""); },
    });
  }
  if (customerFilter) {
    activeFilterChips.push({ key: "customer", label: customerFilter, onRemove: () => setCustomerFilter("") });
  }
  if (productFilter) {
    activeFilterChips.push({ key: "product", label: productFilter, onRemove: () => setProductFilter("") });
  }

  // Left/right scroll arrows for the tab strip — on a narrow phone screen most of the 8 tabs are
  // off-screen with no visual hint they're swipeable, so the arrows both signal "more tabs this
  // way" and give a tap target for it instead of relying purely on a swipe gesture.
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const updateTabScrollArrows = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollTabsLeft(el.scrollLeft > 2);
    setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateTabScrollArrows();
    const el = tabsScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateTabScrollArrows, { passive: true });
    window.addEventListener("resize", updateTabScrollArrows);
    return () => {
      el.removeEventListener("scroll", updateTabScrollArrows);
      window.removeEventListener("resize", updateTabScrollArrows);
    };
  }, []);

  const scrollTabs = (direction: -1 | 1) => {
    tabsScrollRef.current?.scrollBy({ left: direction * 140, behavior: "smooth" });
  };

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
    queryKey: ["orders", activeTab, search, fromDate, toDate, customerFilter, productFilter, currentBranchId],
    queryFn: async () => {
      const base = {
        q: search || undefined,
        customerQuery: customerFilter || undefined,
        productQuery: productFilter || undefined,
        from: fromDate || undefined,
        // Backend does CreatedAt <= to, so a bare date would cut off that day's later orders.
        to: toDate ? `${toDate}T23:59:59` : undefined,
      };
      if (activeTab === "CANCELLED") {
        return listOrders({ ...base, orderStatus: "CANCELLED" });
      }

      // Virtual multi-status tabs — one call per underlying FulfillmentStatus (the API only
      // filters on a single exact one), merged and re-sorted newest-first client-side since
      // separately top-N-sorted lists don't come back interleaved correctly.
      const mergeStatuses = async (statuses: string[]) => {
        const perStatus = await Promise.all(
          statuses.map((status) => listOrders({ ...base, fulfillmentStatus: status }))
        );
        return perStatus.flat().sort((a, b) =>
          a.businessDate !== b.businessDate
            ? (a.businessDate < b.businessDate ? 1 : -1)
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      };

      // "Pending Deliveries" = handed to courier, not yet delivered — see the tab comment above.
      if (activeTab === "PENDING") {
        return listOrders({ ...base, fulfillmentStatus: "IN_TRANSIT" });
      }

      // "New Orders" and "Waiting for Courier" are both UNFULFILLED/PACKED under the hood — the
      // only thing telling them apart is IsDraft (still needs a Confirm/Cancel decision vs
      // already confirmed and just waiting to be handed over), so split on that client-side too.
      if (activeTab === "UNFULFILLED") {
        const orders = await listOrders({ ...base, fulfillmentStatus: "UNFULFILLED" });
        return orders.filter((o) => o.isDraft);
      }
      if (activeTab === "WAITING_COURIER") {
        const orders = await mergeStatuses(WAITING_COURIER_STATUSES);
        return orders.filter((o) => !o.isDraft);
      }

      return listOrders({ ...base, fulfillmentStatus: activeTab || undefined });
    },
    staleTime: 15_000,
  });

  // Grouped by BusinessDate, newest first — sections are always fully expanded (no
  // tap-to-collapse), so grouping only adds a visual date label, not an extra step in front of
  // what staff actually came here to see. The list endpoint already sorts BusinessDate/CreatedAt
  // desc, so groups come out newest-first for free without a client-side re-sort.
  // Every tab except "Cancelled" itself and "All" excludes cancelled orders — otherwise a
  // cancelled order keeps cluttering whatever active fulfillment tab it was in when cancelled
  // (Cancel doesn't touch FulfillmentStatus), even though there's nothing left to act on.
  const visibleOrders = orders.filter((o) =>
    o.channel !== "SHOP" && o.channel !== "HAWKER" &&
    (activeTab === "CANCELLED" || activeTab === "" || o.orderStatus !== "CANCELLED")
  );
  const orderGroups: Array<{ businessDate: string; orders: typeof visibleOrders }> = [];
  for (const order of visibleOrders) {
    const last = orderGroups[orderGroups.length - 1];
    if (last && last.businessDate === order.businessDate) last.orders.push(order);
    else orderGroups.push({ businessDate: order.businessDate, orders: [order] });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold text-gray-900">{t("orders.ordersList")}</h1>
        <Link
          href="/orders/new"
          className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg active:scale-[0.98] transition"
        >
          + {t("orders.newOrder")}
        </Link>
      </div>

      {/* Tabs — left/right arrows over a fade so a narrow phone screen still hints that more
          tabs are scrollable off to that side, not just a bare swipeable strip. */}
      <div className="relative">
        {canScrollTabsLeft && (
          <button
            onClick={() => scrollTabs(-1)}
            aria-label="Scroll tabs left"
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-3 bg-gradient-to-r from-white via-white to-transparent"
          >
            <ChevronLeftIcon className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <div ref={tabsScrollRef} className="flex gap-1 px-3 pt-3 pb-3 overflow-x-auto no-scrollbar">
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
        {canScrollTabsRight && (
          <button
            onClick={() => scrollTabs(1)}
            aria-label="Scroll tabs right"
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-3 bg-gradient-to-l from-white via-white to-transparent"
          >
            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Search + Filter. The quick search box OR-matches order no/customer/product together;
          the Filter sheet's Customer and Product fields are separate AND-able filters instead
          (see ListOrdersParams.customerQuery/productQuery) for narrowing to both at once. */}
      <div className="flex gap-2 px-3 py-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("orders.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {/* Widens to show the active preset's short label (e.g. "7D") instead of staying a bare
            icon once a filter is on, so the button itself communicates what's currently applied. */}
        <button
          onClick={() => setShowFilterSheet(true)}
          aria-label={t("orders.filters")}
          className={`shrink-0 h-10 px-3 flex items-center gap-1.5 rounded-lg border text-xs font-semibold ${
            hasAnyFilter
              ? "bg-indigo-600 border-indigo-600 text-white"
              : "bg-white border-gray-200 text-gray-500"
          }`}
        >
          <FunnelIcon className="w-4 h-4 shrink-0" />
          {activePeriod && <span>{periodLabel(activePeriod)}</span>}
          {!activePeriod && activeFilterChips.length > 0 && <span>{activeFilterChips.length}</span>}
        </button>
      </div>

      {/* Active filter summary — visible without reopening the sheet, each chip independently
          removable. Only rendered when something's actually applied. */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          <span className="text-xs text-gray-400 self-center">{t("orders.filters")}:</span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
            >
              {chip.label}
              <XMarkIcon className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {activeTab !== "" && (
        <div className="px-3 pb-3">
          <OrderProcessGuide activeStep={activeTab} t={t} />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-4">
        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.loading")}</div>
        )}
        {!isLoading && visibleOrders.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t("common.noData")}</div>
        )}
        {!isLoading && orderGroups.map((group) => (
          <div key={group.businessDate}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">
              {orderGroupDateLabel(group.businessDate, t)}
            </p>
            <div className="space-y-2">
            {group.orders.map((order) => {
              // Still-draft orders: FulfillmentStatus/PaymentStatus/due-amount are always the
              // same three boilerplate values pre-confirm (UNFULFILLED/UNPAID/full amount due) —
              // not information, just noise. What actually helps decide confirm-vs-cancel is
              // whether there's enough stock, so that replaces the status badges here. Once
              // confirmed (whether Waiting for Courier, In Transit, ...) the badges become
              // meaningful again and come back — stock is already secured by then anyway.
              const isNew = order.isDraft;
              return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block p-3 rounded-xl border border-gray-300 bg-gray-100 active:bg-gray-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">{order.orderNo}</span>
                  <span className="text-xs bg-white text-gray-600 px-1.5 py-0.5 rounded font-mono">
                    {CHANNEL_ICONS[order.channel] ?? order.channel}
                  </span>
                  {order.branchName && (
                    <span className="text-xs bg-white text-indigo-600 px-1.5 py-0.5 rounded font-medium truncate max-w-[7rem]">
                      🏬 {order.branchName}
                    </span>
                  )}
                  {/* isDraft moved to the bottom badge row (see below) — same spot every other
                      tab's status pill lives in, instead of only this one sitting up here. */}
                  {order.isRevised && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      🔄 {t("orders.revisedBadge")}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900 shrink-0 ml-auto">
                    ৳{order.totalAmount.toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-1 truncate">
                  {t("orders.customerLabel")}: {order.customerName}
                  {order.customerPhone && ` | ${order.customerPhone}`}
                  {order.customerAddress && ` | ${order.customerAddress}`}
                </p>

                {/* Product info — same box, same text-xs sizing, in every tab. Only the content
                    changes: a plain summary line once an order is past "new" (status badges below
                    carry the useful info by then), or per-item qty/stock while it's still new
                    (that's what actually matters before confirm/cancel). Short/out-of-stock still
                    get a red accent — a color cue, not a different container or font size. */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-1.5 mb-1 space-y-1">
                  {isNew ? (
                    // isNew === order.isDraft here, so every item below is genuinely still at
                    // risk of failing to confirm — a confirmed order (Waiting for Courier
                    // onward) already secured its qty in Committed and never reaches this branch.
                    order.items.map((item, idx) => {
                      const outOfStock = item.availableStock <= 0;
                      const short = item.availableStock < item.qty;
                      return (
                        <div key={idx}>
                          <p className="text-xs truncate">
                            <span className="font-semibold text-gray-800">{item.productName}</span>{" "}
                            <span className={outOfStock || short ? "text-red-600 font-semibold" : "text-gray-500"}>
                              ({t("orders.qty")}: {item.qty} | {t("orders.stock")}: {item.availableStock})
                            </span>
                          </p>
                          {outOfStock && (
                            <p className="text-[11px] text-red-600 font-semibold mt-0.5">
                              {t("orders.outOfStockWarning")}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {itemsSummaryText(order.items)}
                    </p>
                  )}
                </div>

                {/* Bottom badge row — the one spot every tab's "what's this order's status" pill
                    lives in. New orders (isNew === isDraft) show the "নতুন" badge here instead of
                    fulfillment/payment (those are always the same boilerplate three values
                    pre-confirm, see isNew above); everything else shows the real status badges. */}
                <div className="flex flex-wrap gap-1 items-center">
                  {isNew ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      {t("orders.newBadge")}
                    </span>
                  ) : order.orderStatus === "CANCELLED" ? (
                    <StatusBadge status="CANCELLED" />
                  ) : (
                    <>
                      <StatusBadge status={order.fulfillmentStatus} />
                      <StatusBadge status={order.paymentStatus} />
                    </>
                  )}
                  {!isNew && order.dueAmount > 0 && (
                    <span className="text-xs text-red-600 font-medium">
                      বাকি ৳{order.dueAmount.toLocaleString()}
                    </span>
                  )}
                  {!isNew && order.handlingUserName && (
                    <span className="text-xs text-gray-400 ml-auto">
                      → {order.handlingUserName}
                    </span>
                  )}
                  {!isNew && order.trackingNo && (
                    <span className="text-xs text-indigo-600">{order.trackingNo}</span>
                  )}
                </div>
              </Link>
              );
            })}
            </div>
          </div>
        ))}
      </div>

      {/* Filter sheet. Date presets reuse the same Today/7D/30D/3M convention as Reports'
          DateRangeBar instead of inventing a parallel one — the active one stays highlighted
          here so reopening the sheet always shows what's currently applied. Customer/Product
          are separate AND-able fields (ListOrdersParams.customerQuery/productQuery), distinct
          from the quick-search box up top which OR-matches everything at once. */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilterSheet(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <button
              onClick={() => setShowFilterSheet(false)}
              aria-label="Close"
              className="absolute right-3 top-3 p-1 rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-gray-900 pr-6">{t("orders.filters")}</p>

            <div>
              <div className="grid grid-cols-4 gap-2">
                {(["today", "7d", "30d", "3m"] as ReportPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => applyDatePeriod(period)}
                    className={`py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      activePeriod === period
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-gray-200 text-gray-700 active:bg-gray-50"
                    }`}
                  >
                    {periodLabel(period)}
                  </button>
                ))}
              </div>

              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1.5">{t("orders.customRange")}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setActivePeriod(null); }}
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <span className="text-xs text-gray-400">{t("orders.dateRangeTo")}</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setActivePeriod(null); }}
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">{t("orders.customerLabel")}</p>
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder={t("customers.searchPlaceholder")}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">{t("orders.orderProduct")}</p>
              <input
                type="text"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder={t("products.searchPlaceholder")}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={clearAllFilters}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                {t("common.clear")}
              </button>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
              >
                {t("orders.apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
