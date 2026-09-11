"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  TruckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { BellAlertIcon } from "@heroicons/react/24/solid";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatVariantLabel } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media";
import { getHomeSummary, getInventoryReport } from "@/lib/reportsApi";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

function money(value: number) {
  return `৳${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function MetricCard({
  label,
  value,
  detail,
  Icon,
  tone,
  href,
  wide,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  Icon: Icon;
  tone: "emerald" | "amber";
  href?: string;
  wide?: boolean;
}) {
  const styles = tone === "emerald"
    ? "border-emerald-100 bg-emerald-50/70 text-emerald-700"
    : "border-amber-100 bg-amber-50/70 text-amber-700";
  const content = (
    <>
      <div className="relative min-h-5">
        <p className="px-6 text-center text-xs font-medium text-gray-600">{label}</p>
        <Icon className="absolute right-0 top-0 h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-2 text-center text-2xl font-bold text-gray-950 font-tabular-nums">{value}</p>
      <div className="mt-1 min-h-5 text-center text-xs text-[#800000]">{detail}</div>
    </>
  );

  const className = `rounded-lg border p-4 ${styles} ${wide ? "col-span-2" : ""}`;
  return href
    ? <Link href={href} className={`${className} block active:scale-[0.99] transition`}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function InfoLabel({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "blue" | "orange" | "rose" | "violet";
}) {
  const styles = {
    blue: "text-blue-700",
    orange: "text-orange-700",
    rose: "text-rose-700",
    violet: "text-violet-700",
  }[tone];

  return (
    <Link href={href} className="inline-flex min-w-0 items-baseline gap-1.5 py-1 transition active:opacity-60">
      <span className={`shrink-0 text-sm font-bold font-tabular-nums ${styles}`}>{value}</span>
      <span className="text-xs leading-4 text-gray-600">{label}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const [showHotNotifications, setShowHotNotifications] = useState(false);
  const { user, businesses, branches, currentBusinessId, currentBranchId } = useAuthStore();
  const { lang, t } = useLanguage();
  const currentBusiness = businesses.find((business) => business.id === currentBusinessId);
  const currentBranch = branches.find((branch) => branch.id === currentBranchId);
  const canSeeCosts = user?.role === "OWNER" || user?.role === "MANAGER";
  const isHawker = currentBusiness?.salesChannels?.includes("HAWKER") ?? false;
  const dashboardDate = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date());

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-home-summary", currentBusinessId, currentBranchId],
    queryFn: getHomeSummary,
    staleTime: 30_000,
  });

  const { data: inventoryData, isLoading: isInventoryLoading } = useQuery({
    queryKey: ["dashboard-low-stock-products", currentBusinessId, currentBranchId],
    queryFn: () => getInventoryReport({}),
    staleTime: 120_000,
    enabled: showHotNotifications,
  });

  if (isLoading) {
    return (
      <div className="min-h-full space-y-5 bg-gray-50 px-4 py-5">
        <div className="space-y-2"><div className="h-4 w-28 animate-pulse rounded bg-gray-200" /><div className="h-7 w-48 animate-pulse rounded bg-gray-200" /></div>
        <div className="grid grid-cols-2 gap-3"><div className="h-32 animate-pulse rounded-lg border border-gray-100 bg-white" /><div className="h-32 animate-pulse rounded-lg border border-gray-100 bg-white" /></div>
        <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg border border-gray-100 bg-white" />)}</div>
        <div className="h-44 animate-pulse rounded-lg border border-gray-100 bg-white" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
        <ExclamationTriangleIcon className="h-9 w-9 text-red-500" />
        <p className="text-sm font-semibold text-gray-900">{t("dashboard.loadFailed")}</p>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {t("dashboard.tryAgain")}
        </button>
      </div>
    );
  }

  const stockAlerts = data.lowStockCount + data.outOfStockCount;
  const lowStockProducts = (inventoryData?.items ?? [])
    .filter((item) => item.isLowStock || item.isOutOfStock)
    .sort((a, b) => Number(b.isOutOfStock) - Number(a.isOutOfStock) || a.available - b.available || a.productName.localeCompare(b.productName))
    .slice(0, 5);
  const salesChange = data.salesChangePercent;
  const salesDetail = salesChange === null
    ? t("dashboard.yesterdaySales", { amount: money(data.yesterdaySales) })
    : salesChange > 0
      ? <span className="inline-flex items-center gap-1 text-[#800000]"><ArrowTrendingUpIcon className="h-4 w-4" />{t("dashboard.moreThanYesterday", { value: Math.abs(salesChange) })}</span>
      : salesChange < 0
        ? <span className="inline-flex items-center gap-1 text-[#800000]"><ArrowTrendingDownIcon className="h-4 w-4" />{t("dashboard.lessThanYesterday", { value: Math.abs(salesChange) })}</span>
        : t("dashboard.sameAsYesterday");

  const attentionItems: Array<{ title: string; detail: string; href: string; rowTone: string; iconTone: string; Icon: Icon }> = [];
  if (data.pendingOrders > 0) attentionItems.push({
    title: t("dashboard.pendingOrderAlert", { count: data.pendingOrders }),
    detail: t("dashboard.pendingOrderAlertDesc"),
    href: "/orders?tab=WAITING_COURIER",
    rowTone: "bg-orange-100 active:bg-orange-200",
    iconTone: "bg-white/70 text-orange-700",
    Icon: ClipboardDocumentListIcon,
  });
  if (stockAlerts > 0) attentionItems.push({
    title: t("dashboard.stockAlertMessage", { count: stockAlerts }),
    detail: t("dashboard.stockAlertMessageDesc", { low: data.lowStockCount, out: data.outOfStockCount }),
    href: "/more/reports/inventory?tab=low",
    rowTone: "bg-orange-100 active:bg-orange-200",
    iconTone: "bg-white/70 text-orange-700",
    Icon: ArchiveBoxIcon,
  });
  if (data.pendingDeliveries > 0) attentionItems.push({
    title: t("dashboard.deliveryAlert", { count: data.pendingDeliveries }),
    detail: t("dashboard.deliveryAlertDesc"),
    href: "/orders?tab=PENDING",
    rowTone: "bg-orange-100 active:bg-orange-200",
    iconTone: "bg-white/70 text-orange-700",
    Icon: TruckIcon,
  });
  if (data.todayReturns > 0) attentionItems.push({
    title: t("dashboard.returnAlert", { count: data.todayReturns }),
    detail: t("dashboard.returnAlertDesc"),
    href: "/orders?tab=RETURNED",
    rowTone: "bg-orange-100 active:bg-orange-200",
    iconTone: "bg-white/70 text-orange-700",
    Icon: ArrowPathIcon,
  });

  const quickActions: Array<{ label: string; href: string; Icon: Icon; color: string }> = [
    { label: t("dashboard.newOrder"), href: "/orders/new", Icon: ClipboardDocumentListIcon, color: "bg-indigo-600" },
    ...(user?.canAccessPos ? [{ label: t("dashboard.posSale"), href: isHawker ? "/hawker/night-entry" : "/pos", Icon: ShoppingCartIcon, color: "bg-green-600" }] : []),
    { label: t("nav.salesRecord"), href: "/sales-record", Icon: BanknotesIcon, color: "bg-teal-600" },
    ...(canSeeCosts ? [
      { label: t("dashboard.newPurchase"), href: "/more/purchases/new", Icon: TruckIcon, color: "bg-amber-500" },
      { label: t("dashboard.addExpense"), href: "/more/expenses/new", Icon: CurrencyDollarIcon, color: "bg-red-500" },
      { label: t("dashboard.customers"), href: "/more/customers", Icon: UserGroupIcon, color: "bg-purple-600" },
    ] : [
      { label: t("dashboard.deliveries"), href: "/more/deliveries", Icon: TruckIcon, color: "bg-amber-500" },
      { label: t("nav.products"), href: "/products", Icon: ArchiveBoxIcon, color: "bg-purple-600" },
    ]),
  ];

  const chartData = data.sevenDaySales.map((point) => ({
    ...point,
    day: new Date(`${point.label}T00:00:00`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { weekday: "short" }),
  }));
  const chartValue = (value: number) => `৳${new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;

  return (
    <div className="min-h-full bg-gray-50 pb-6">
      <header className="border-b border-gray-200 bg-white px-4 py-5">
        <p className="text-sm text-gray-500">{t("dashboard.welcomeBack")} {user?.name}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-950">{currentBusiness?.name ?? "LavLokshan"}</h1>
            {branches.length > 1 && (
              <p className="mt-0.5 text-xs text-gray-500">{currentBranch?.name ?? t("dashboard.allBranches")}</p>
            )}
          </div>
          <span suppressHydrationWarning className="min-w-32 shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-center text-xs font-medium text-emerald-700">{dashboardDate}</span>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5">
        <section aria-labelledby="business-today-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="business-today-title" className="text-sm font-bold text-gray-900">{t("dashboard.businessToday")}</h2>
            <Link href="/more/reports/daily-closing" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">{t("dashboard.fullSummary")}<ArrowRightIcon className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <InfoLabel label={t("dashboard.ordersToday")} value={data.todayOrders} href="/sales-record?from=today&to=today" tone="blue" />
            <InfoLabel label={t("dashboard.pendingOrders")} value={data.pendingOrders} href="/orders?tab=WAITING_COURIER" tone="orange" />
            <InfoLabel label={t("dashboard.stockAlerts")} value={stockAlerts} href="/more/reports/inventory?tab=low" tone="rose" />
            <InfoLabel label={t("dashboard.pendingDeliveries")} value={data.pendingDeliveries} href="/orders?tab=PENDING" tone="violet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label={t("dashboard.todaySales")} value={money(data.todaySales)} detail={salesDetail} Icon={ArrowTrendingUpIcon} tone="emerald" wide={!canSeeCosts} href="/sales-record?from=today&to=today" />
            {canSeeCosts && data.todayProfit !== null && (
              <MetricCard label={t("dashboard.todayProfit")} value={money(data.todayProfit)} detail={t("dashboard.margin", { value: data.todayMarginPercent ?? 0 })} Icon={CurrencyDollarIcon} tone="amber" href="/more/reports/financial" />
            )}
          </div>
        </section>

        <section aria-labelledby="quick-actions-title">
          <h2 id="quick-actions-title" className="mb-3 text-sm font-bold text-gray-900">{t("dashboard.quickActions")}</h2>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map(({ label, href, Icon, color }) => (
              <Link key={href} href={href} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg p-3 text-center text-white shadow-sm transition active:scale-[0.98] ${color}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-semibold leading-4 text-white">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <button
          type="button"
          aria-expanded={showHotNotifications}
          aria-controls="hot-notifications-panel"
          onClick={() => setShowHotNotifications((visible) => !visible)}
          className="flex w-full items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-[#800000] transition active:bg-rose-100"
        >
          <BellAlertIcon className="h-5 w-5 shrink-0" />
          <span className="flex-1">{t("dashboard.hotNotifications")}</span>
          <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${showHotNotifications ? "rotate-180" : ""}`} />
        </button>

        {showHotNotifications && (
          <div id="hot-notifications-panel" className="space-y-6">
        <section aria-labelledby="attention-title">
          <h2 id="attention-title" className="mb-3 text-sm font-bold text-gray-900">{t("dashboard.attentionRequired")}</h2>
          <div className="space-y-2">
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4">
                <CheckCircleIcon className="h-7 w-7 shrink-0 text-emerald-600" />
                <div><p className="text-sm font-semibold text-gray-900">{t("dashboard.allClear")}</p><p className="mt-0.5 text-xs text-gray-500">{t("dashboard.allClearDesc")}</p></div>
              </div>
            ) : attentionItems.map((item) => (
              <Link key={item.href + item.title} href={item.href} className={`flex items-center gap-3 rounded-lg border border-orange-200 px-4 py-3 transition ${item.rowTone}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.iconTone}`}><item.Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-900">{item.title}</span><span className="mt-0.5 block text-xs text-gray-500">{item.detail}</span></span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="low-stock-products-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="low-stock-products-title" className="text-sm font-bold text-gray-900">{t("reports.inventory.productsNeedRestock")}</h2>
            <Link href="/more/reports/inventory?tab=low" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-600">
              {t("dashboard.viewReport")}<ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          {isInventoryLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <div key={item} className="h-[74px] animate-pulse rounded-lg border border-gray-100 bg-white" />)}
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
              <CheckCircleIcon className="h-7 w-7 shrink-0 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">{t("reports.inventory.noLowStockProducts")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map((item) => {
                const imageUrl = resolveMediaUrl(item.imageUrl);
                const variantLabel = formatVariantLabel(item.variantLabel);

                return (
                  <Link key={item.variantSku} href="/more/reports/inventory?tab=low" className="flex items-center gap-3 rounded-lg border border-[#650000] bg-[#800000] p-3 transition active:bg-[#680000]">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/80 bg-white">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                      ) : (
                        <ArchiveBoxIcon className="h-6 w-6 text-gray-300" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{item.productName}</span>
                      {variantLabel && <span className="mt-0.5 block truncate text-xs text-white/80">{variantLabel}</span>}
                      <span className="mt-0.5 block truncate text-xs text-white/70">SKU: {item.variantSku}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-bold text-white font-tabular-nums">{item.available}</span>
                      <span className="block text-[10px] font-semibold text-rose-100">
                        {t(item.isOutOfStock ? "reports.inventory.outOfStock" : "reports.inventory.lowStock")}
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-white/70" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {canSeeCosts && (
          <section aria-labelledby="money-position-title">
            <h2 id="money-position-title" className="mb-3 text-sm font-bold text-gray-900">{t("dashboard.moneyPosition")}</h2>
            <div className="space-y-2">
              {[
                { label: t("dashboard.customerReceivable"), value: money(data.customerReceivable), detail: t("dashboard.customerCount", { count: data.customersWithDue }), color: "text-blue-700", href: "/more/customers" },
                { label: t("dashboard.supplierPayable"), value: money(data.supplierPayable ?? 0), detail: t("dashboard.supplierCount", { count: data.suppliersWithDue ?? 0 }), color: "text-red-700", href: "/more/purchases" },
                { label: t("dashboard.courierReceivable"), value: money(data.moneyAtCourier), detail: t("dashboard.awaitingRemittance"), color: "text-violet-700", href: "/more/deliveries" },
                { label: t("dashboard.cashReceivedToday"), value: money(data.todayCash), detail: t("dashboard.cashOnly"), color: "text-emerald-700", href: "/sales-record?from=today&to=today" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between gap-4 rounded-lg border border-sky-200 bg-sky-100 px-4 py-3 transition active:bg-sky-200">
                  <div><p className="text-sm font-medium text-gray-800">{item.label}</p><p className="mt-0.5 text-xs text-gray-500">{item.detail}</p></div>
                  <p className={`shrink-0 text-base font-bold font-tabular-nums ${item.color}`}>{item.value}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="performance-title">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 id="performance-title" className="text-sm font-bold text-gray-900">{t("dashboard.todayPerformance")}</h2><p className="mt-0.5 text-xs text-gray-500">{t("dashboard.lastSevenDays")}</p></div>
            <Link href="/more/reports/dashboard" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">{t("dashboard.viewReport")}<ArrowRightIcon className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 24, right: 10, left: 10, bottom: 0 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <Tooltip cursor={{ fill: "#f3f4f6" }} formatter={(value) => [money(Number(value ?? 0)), t("dashboard.sales")]} contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((point, index) => <Cell key={point.label} fill={index === chartData.length - 1 ? "#059669" : "#a7f3d0"} />)}
                    <LabelList dataKey="value" position="top" offset={6} formatter={(value) => chartValue(Number(value ?? 0))} fill="#4b5563" fontSize={9} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-gray-700">{t("dashboard.topSellingToday")}</p>
              {data.topProductsToday.length === 0 ? (
                <p className="text-xs text-gray-500">{t("dashboard.noSalesYet")}</p>
              ) : (
                <div className="space-y-2.5">
                  {data.topProductsToday.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600">{index + 1}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-800">{product.name}</p><p className="text-xs text-gray-500">{t("dashboard.soldQuantity", { count: product.quantity })}</p></div>
                      <p className="shrink-0 text-sm font-semibold text-gray-900 font-tabular-nums">{money(product.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
          </div>
        )}
      </div>
    </div>
  );
}
