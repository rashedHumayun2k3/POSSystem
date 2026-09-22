"use client";

import { Fragment, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  MagnifyingGlassIcon, FunnelIcon, XMarkIcon, PlusIcon, CubeIcon, PhoneIcon, ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon, ArrowPathIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { groupByBusinessDate } from "@/lib/orderListHelpers";
import { listOrderManagement } from "@/lib/ordersApi";
import { resolveMediaUrl } from "@/lib/media";
import { useLanguage } from "@/i18n/LanguageContext";
import { orderManagementCopy } from "@/i18n/orderManagement";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/ui/StatusBadge";
import SlidePanel from "@/components/ui/SlidePanel";
import { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod } from "@/types/reports";
import type { OrderListItem, OrderListItemSummary } from "@/types/orders";

const TABS = [
  { key: "ALL", color: "bg-slate-800 hover:bg-slate-900", hint: "allHint" },
  { key: "UNFULFILLED", color: "bg-blue-700 hover:bg-blue-800", hint: "newHint" },
  { key: "PROCESSING", color: "bg-violet-700 hover:bg-violet-800", hint: "processingHint" },
  { key: "WAITING_COURIER", color: "bg-amber-800 hover:bg-amber-900", hint: "courierHint" },
  { key: "PENDING", color: "bg-cyan-800 hover:bg-cyan-900", hint: "transitHint" },
  { key: "DELIVERED", color: "bg-emerald-700 hover:bg-emerald-800", hint: "deliveredHint" },
  { key: "RETURNED", color: "bg-orange-800 hover:bg-orange-900", hint: "returnedHint" },
  { key: "CANCELLED", color: "bg-zinc-600 hover:bg-zinc-700", hint: "cancelledHint" },
  { key: "ISSUES", color: "bg-red-700 hover:bg-red-800", hint: "issuesHint" },
] as const;
type Tab = typeof TABS[number]["key"];
type Copy = typeof orderManagementCopy.en;
const CHANNELS: Record<string, string> = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", MYWEBSITE: "Website", WEBSITE: "Marketplace", PHONE: "Phone", OTHER: "Other" };
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed";
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const input = "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500";
const emptyFilters = { from: "", to: "", customer: "", product: "", channel: "" };

function whatsAppNumber(phone: string) {
  const digits = phone.replace(/[০-৯]/g, digit => String(digit.charCodeAt(0) - 0x09e6)).replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  return /^01\d{9}$/.test(digits) ? `88${digits}` : digits;
}

function hasStockIssue(order: OrderListItem) {
  return order.isDraft && order.orderStatus !== "CANCELLED" && order.items.some(item => item.availableStock < item.qty);
}

const ORDER_BACKGROUNDS: Record<Tab, string> = {
  ALL: "bg-white hover:bg-slate-50",
  UNFULFILLED: "bg-gray-50 hover:bg-gray-100",
  PROCESSING: "bg-violet-50 hover:bg-violet-100",
  WAITING_COURIER: "bg-amber-50 hover:bg-amber-100",
  PENDING: "bg-cyan-50 hover:bg-cyan-100",
  DELIVERED: "bg-emerald-50 hover:bg-emerald-100",
  RETURNED: "bg-orange-50 hover:bg-orange-100",
  CANCELLED: "bg-slate-100 hover:bg-slate-200",
  ISSUES: "bg-red-50 hover:bg-red-100",
};

function orderBackground(order: OrderListItem) {
  return ORDER_BACKGROUNDS[hasStockIssue(order) ? "ISSUES" : queueFor(order)];
}

function queueFor(order: OrderListItem): Tab {
  if (order.orderStatus === "CANCELLED") return "CANCELLED";
  if (order.isDraft) return "UNFULFILLED";
  if (order.fulfillmentStatus === "UNFULFILLED") return "PROCESSING";
  if (order.fulfillmentStatus === "PACKED") return "WAITING_COURIER";
  if (order.fulfillmentStatus === "IN_TRANSIT") return "PENDING";
  return order.fulfillmentStatus;
}

function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { lang } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} aria-labelledby="orders-dialog-title" onCancel={close}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-slate-900/40">
    <div className="flex items-center justify-between border-b border-gray-100 p-5">
      <h2 id="orders-dialog-title" className="font-semibold">{title}</h2>
      <button onClick={close} aria-label={orderManagementCopy[lang].close} className={button}><XMarkIcon className="size-4" /></button>
    </div>{children}
  </dialog>;
}

function ProductImage({ item }: { item: OrderListItemSummary }) {
  const [failed, setFailed] = useState(false);
  const url = resolveMediaUrl(item.imageUrl);
  return <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-gray-400">
    {url && !failed ?
      // Store media follows the same external-host convention as the product catalog.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} /> : <CubeIcon className="size-5" />}
  </div>;
}

function Products({ order, copy }: { order: OrderListItem; copy: Copy }) {
  return <div className="space-y-2.5">
    {order.items.slice(0, 2).map((item, index) => <div className="flex items-center gap-2.5" key={`${item.variantSku}-${index}`}>
      <ProductImage item={item} /><div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800" title={item.productName}>{item.productName}</p>
        <p className="truncate text-xs text-gray-500" title={item.variantSku}><span className="font-medium">×{item.qty}</span>{item.variantSku && <span className="ml-2">{item.variantSku}</span>}</p>
        {order.isDraft && order.orderStatus !== "CANCELLED" && item.availableStock < item.qty && <p className="text-xs font-medium text-red-600">{copy.available}: {item.availableStock}</p>}
      </div>
    </div>)}
    {order.items.length > 2 && <Link href={`/orders/${order.id}`} className="ml-[50px] block text-xs font-medium text-indigo-600 hover:underline">+{order.items.length - 2} {copy.moreItems}</Link>}
  </div>;
}

function OrderStatus({ order, copy, branchName, showPayment = false }: { order: OrderListItem; copy: Copy; branchName?: string; showPayment?: boolean }) {
  const issue = hasStockIssue(order);
  const status = queueFor(order);
  const styles: Record<Tab, string> = {
    ALL: "bg-gray-100 text-gray-700", UNFULFILLED: "bg-blue-50 text-blue-700", PROCESSING: "bg-violet-50 text-violet-700",
    WAITING_COURIER: "bg-amber-50 text-amber-800", PENDING: "bg-cyan-50 text-cyan-800", DELIVERED: "bg-emerald-50 text-emerald-700",
    RETURNED: "bg-orange-50 text-orange-800", CANCELLED: "bg-gray-100 text-gray-600", ISSUES: "bg-red-50 text-red-700",
  };
  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-center gap-1.5">
    {branchName && <span className="inline-flex min-h-6 max-w-full items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium leading-4 text-indigo-700 break-words">{branchName}</span>}
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium leading-4 ${styles[issue ? "ISSUES" : status]}`}>
      {issue && <ExclamationTriangleIcon className="size-3.5" />}{issue ? copy.stockIssue : copy[status]}
    </span>
    {showPayment && !order.isDraft && <div className="flex [&>span]:min-h-6 [&>span]:py-1 [&>span]:leading-4"><StatusBadge status={order.paymentStatus} /></div>}
    </div>
    {issue && <p className="text-xs text-red-600">{copy.cannotDeliver}</p>}
    {order.isRevised && <p className="text-xs text-amber-700">{copy.revised}</p>}
    {order.handlingUserName && <p className="text-xs text-gray-500">{copy.assigned}: {order.handlingUserName}</p>}
    {order.trackingNo && <p className="max-w-40 break-all text-xs text-gray-500">{copy.tracking}: {order.trackingNo}</p>}
  </div>;
}

function LoadingOrders({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="space-y-3 p-4">
    {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex animate-pulse gap-6 rounded-xl border border-gray-100 p-5 motion-reduce:animate-none">
      <div className="size-10 rounded-lg bg-gray-100" /><div className="flex-1 space-y-3"><div className="h-3 w-2/3 rounded bg-gray-100" /><div className="h-3 w-1/3 rounded bg-gray-100" /></div><div className="h-6 w-16 rounded bg-gray-100" />
    </div>)}
  </div>;
}

export default function OrderManagement() {
  return <Suspense fallback={<LoadingOrders label="Loading orders" />}><OrderManagementInner /></Suspense>;
}

function OrderManagementInner() {
  const { lang, t } = useLanguage();
  const copy = orderManagementCopy[lang];
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    return TABS.some(item => item.key === tab) ? tab as Tab : "UNFULFILLED";
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [actionOrder, setActionOrder] = useState<OrderListItem | null>(null);
  const [page, setPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const branch = useAuthStore(s => s.currentBranchId);
  const showBranchName = useAuthStore(s => s.branches.length > 1);
  const business = useAuthStore(s => s.currentBusinessId);
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["orders", "management", branch, business, activeTab, debouncedSearch, filters, page],
    queryFn: ({ signal }) => listOrderManagement({
      tab: activeTab, page, q: debouncedSearch || undefined, channel: filters.channel || undefined,
      from: filters.from || undefined, to: filters.to ? `${filters.to}T23:59:59.999` : undefined,
      customerQuery: filters.customer || undefined, productQuery: filters.product || undefined,
    }, signal),
  });
  const changeTab = (tab: Tab) => { setActiveTab(tab); setPage(1); };
  const clear = () => { setFilters(emptyFilters); setSearch(""); setDebouncedSearch(""); setPage(1); };
  const openFilters = () => { setDraftFilters(filters); setShowFilters(true); };
  const filterCount = Object.values(filters).filter(Boolean).length;
  const dateInvalid = Boolean(draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to);
  const money = (amount: number) => `৳${amount.toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { maximumFractionDigits: 2 })}`;
  const date = (businessDate: string) => new Date(`${businessDate}T00:00:00`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const orderGroups = activeTab === "ALL"
    ? TABS.filter(tab => tab.key !== "ALL" && tab.key !== "ISSUES").flatMap(tab =>
        groupByBusinessDate((data?.items ?? []).filter(order => queueFor(order) === tab.key))
          .map((group, index) => ({ ...group, key: `${tab.key}-${group.businessDate}`, section: index === 0 ? copy.sections[tab.key] : null })))
    : groupByBusinessDate(data?.items ?? []).map(group => ({ ...group, key: group.businessDate, section: null }));
  const currentPage = data?.page ?? page;
  const pageCount = Math.max(1, Math.ceil((data?.totalCount ?? 0) / (data?.pageSize ?? 25)));
  const source = (order: OrderListItem) => <span className="inline-flex max-w-full items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 break-words">
    {CHANNELS[order.channel] ?? order.channel}
  </span>;
  const actions = (order: OrderListItem) => <div className="grid grid-cols-2 items-stretch gap-2">
    <Link href={`/orders/${order.id}`} aria-label={`${hasStockIssue(order) ? copy.resolve : copy.viewOrder} ${order.orderNo}`}
      className={`inline-flex min-h-9 min-w-0 items-center justify-center rounded-lg px-3 py-1.5 text-center text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${hasStockIssue(order) ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500" : "bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500"}`}>
      {hasStockIssue(order) ? copy.resolve : copy.viewOrder}
    </Link><button type="button" className="inline-flex min-h-9 min-w-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 active:bg-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2" onClick={() => setActionOrder(order)} aria-label={`${copy.contactCustomer}: ${order.orderNo}`} aria-haspopup="dialog">{copy.contactCustomer}</button>
  </div>;

  return <div className="min-h-[calc(100dvh-8rem)] bg-slate-50/70 px-4 py-5">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-gray-900 lg:text-3xl">{copy.title}</h1><p className="mt-1 hidden text-sm text-gray-500 sm:block">{copy.subtitle}</p></div>
      <div className="flex items-center gap-2">
        <div role="group" aria-label={copy.displayOptions} className="flex rounded-lg border border-gray-200 bg-white p-1 md:hidden">
          {[
            { detailed: true, label: copy.showDetails, Icon: ArrowsPointingOutIcon },
            { detailed: false, label: copy.showLess, Icon: ArrowsPointingInIcon },
          ].map(({ detailed, label, Icon }) => (
            <button key={label} type="button" title={label} aria-label={label} aria-pressed={showDetails === detailed}
              onClick={() => setShowDetails(detailed)}
              className={`flex size-9 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${showDetails === detailed ? "bg-indigo-50 text-indigo-700" : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"}`}>
              <Icon aria-hidden="true" className="size-5" />
            </button>
          ))}
        </div>
        <Link href="/orders/new" className={primary}><PlusIcon className="size-4" /><span className="hidden sm:inline">{copy.create}</span><span className="sm:hidden">{copy.createShort}</span></Link>
      </div>
    </header>
    {(data?.counts.ISSUES ?? 0) > 0 && activeTab !== "ISSUES" && <aside className="mb-5 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 p-3.5">
      <ExclamationTriangleIcon className="size-5 shrink-0 text-red-600" /><div className="flex-1"><p className="text-sm font-semibold text-red-800">{data!.counts.ISSUES} {copy.attention}</p><p className="mt-0.5 hidden text-xs text-red-700 sm:block">{copy.attentionBody}</p></div>
      <button onClick={() => changeTab("ISSUES")} className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">{copy.review} →</button>
    </aside>}
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <nav aria-label={copy.status} className="flex items-center border-b border-gray-100 px-1 sm:px-3">
        <button onClick={() => tabsRef.current?.scrollBy({ left: -220, behavior: "smooth" })} className="shrink-0 rounded p-1 text-gray-400 hover:text-indigo-600" aria-label={copy.scrollLeft}><ChevronLeftIcon className="size-4" /></button>
        <div ref={tabsRef} className="scrollbar-hide flex flex-1 gap-2 overflow-x-auto px-1 py-2">
          {TABS.map(tab => <button key={tab.key} aria-pressed={activeTab === tab.key} onClick={() => changeTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1 text-xs font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 ${tab.color} ${activeTab === tab.key ? "ring-2 ring-slate-900 ring-offset-2 underline underline-offset-4" : ""}`}>
            {copy[tab.key]}<span className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-white tabular-nums">{data ? data.counts[tab.key] ?? 0 : "—"}</span>
          </button>)}
        </div>
        <button onClick={() => tabsRef.current?.scrollBy({ left: 220, behavior: "smooth" })} className="shrink-0 rounded p-1 text-gray-400 hover:text-indigo-600" aria-label={copy.scrollRight}><ChevronRightIcon className="size-4" /></button>
      </nav>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 size-5 text-gray-400" /><input aria-label={copy.search} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={copy.search} className={`${input} pl-10`} /></div>
          <button className={button} onClick={openFilters}><FunnelIcon className="size-4" />{copy.filters}{filterCount > 0 && <span className="rounded bg-indigo-50 px-1.5 text-indigo-700">{filterCount}</span>}</button>
          <select aria-label={t("orders.customRange")} value={filters.from || filters.to ? "custom" : "all"} className={`${input} !w-auto flex-1 sm:max-w-52 sm:flex-none`}
            onChange={e => { if (e.target.value === "custom") openFilters(); else if (e.target.value === "all") { setFilters({ ...filters, from: "", to: "" }); setPage(1); } else { setFilters({ ...filters, ...periodToDates(e.target.value as ReportPeriod) }); setPage(1); } }}>
            <option value="all">{copy.dates}</option><option value="today">{t("orders.today")}</option><option value="7d">7D</option><option value="30d">30D</option><option value="3m">3M</option><option value="custom">{t("orders.customRange")}{filters.from || filters.to ? ` · ${filters.from || "…"} – ${filters.to || "…"}` : ""}</option>
          </select>
        </div>
        {filterCount > 0 && <div className="flex flex-wrap items-center gap-2">
          {Object.entries(filters).filter(([, value]) => value).map(([key, value]) => <button key={key} onClick={() => { setFilters({ ...filters, [key]: "" }); setPage(1); }} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700" aria-label={`${copy.clear}: ${value}`}>
            {copy[key as keyof typeof emptyFilters]}: {key === "channel" ? CHANNELS[value] ?? value : value}<XMarkIcon className="size-3" />
          </button>)}<button onClick={clear} className="text-xs font-medium text-gray-500 hover:text-gray-900">{copy.clear}</button>
        </div>}
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500"><p>{copy[TABS.find(tab => tab.key === activeTab)!.hint]}</p><p aria-live="polite" className="shrink-0 tabular-nums">{isFetching && !isPending ? copy.updating : data ? `${data.totalCount} ${filterCount || search ? copy.matching : copy.results}` : ""}</p></div>
      </div>
      {isPending ? <LoadingOrders label={copy.loading} /> : isError ? <div role="alert" className="px-4 py-16 text-center"><ExclamationTriangleIcon className="mx-auto mb-3 size-8 text-red-400" /><h2 className="font-semibold text-gray-900">{copy.error}</h2><p className="mb-5 mt-1 text-sm text-gray-500">{copy.errorBody}</p><button onClick={() => refetch()} className={button}><ArrowPathIcon className="size-4" />{copy.retry}</button></div> : !data?.items.length ?
        <div className="px-4 py-16 text-center"><CubeIcon className="mx-auto mb-3 size-10 text-gray-300" /><h2 className="font-semibold text-gray-900">{copy.empty}</h2><p className="mb-5 mt-1 text-sm text-gray-500">{copy.emptyBody}</p><button onClick={() => { clear(); changeTab("ALL"); }} className={button}>{copy.clear}</button></div> : <>
          <div className="hidden md:block"><table className="w-full table-fixed text-left [overflow-wrap:anywhere]"><caption className="sr-only">{copy.subtitle}</caption>
            <colgroup><col className="w-[22%]" /><col className="w-[25%]" /><col /><col className="w-28" /></colgroup>
            <thead className="border-y border-gray-100 bg-gray-50/80 text-xs text-gray-500"><tr>{[copy.order, copy.customer, copy.product, copy.amount].map(label => <th scope="col" key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
            {orderGroups.map(group => <tbody key={group.key}>
              {group.section && <tr><th scope="rowgroup" colSpan={4} className="px-3 py-3 text-base font-semibold text-gray-900">{group.section}</th></tr>}
              <tr className="bg-slate-100/80"><th scope="rowgroup" colSpan={4} className="px-3 py-3 text-sm font-semibold text-slate-700"><time dateTime={group.businessDate}>{date(group.businessDate)}</time></th></tr>
              {group.orders.map(order => <Fragment key={order.id}>
                <tr className={`align-top transition-colors duration-200 ${orderBackground(order)}`}>
                  <td className="px-3 pb-2 pt-4"><div className="flex flex-wrap items-start gap-1.5"><Link href={`/orders/${order.id}`} className="min-w-0 break-all text-sm font-semibold text-indigo-700 hover:underline">{order.orderNo}</Link>{source(order)}</div></td>
                  <td className="px-3 pb-2 pt-4"><p className="text-sm font-semibold text-gray-800">{order.customerName}</p>{order.customerPhone && <a className="mt-1 block text-xs text-gray-500 hover:text-indigo-600" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>}{order.customerAddress && <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-400" title={order.customerAddress}>{order.customerAddress}</p>}</td>
                  <td className="px-3 pb-2 pt-4"><Products order={order} copy={copy} /></td>
                  <td className="px-3 pb-2 pt-4"><p className="text-base font-semibold tabular-nums text-gray-900">{money(order.totalAmount)}</p>{!order.isDraft && <div className="mt-2"><StatusBadge status={order.paymentStatus} /></div>}{!order.isDraft && order.dueAmount > 0 && <p className="mt-1 text-xs text-red-600">{copy.due} {money(order.dueAmount)}</p>}</td>
                </tr>
                <tr className={`border-b border-gray-200 transition-colors duration-200 ${orderBackground(order)}`}>
                  <td colSpan={4} className="px-3 pb-4 pt-2"><div className="space-y-3">
                    <div className="min-w-0"><OrderStatus order={order} copy={copy} branchName={showBranchName ? order.branchName : undefined} /></div>
                    <div className="w-full">{actions(order)}</div>
                  </div></td>
                </tr>
              </Fragment>)}
            </tbody>)}
          </table></div>
          <div className="space-y-5 bg-slate-50/60 p-3 md:hidden">{orderGroups.map(group => <section key={group.key} aria-label={group.section ? `${group.section} · ${date(group.businessDate)}` : date(group.businessDate)}>{group.section && <h2 className="mb-3 px-1 pt-2 text-base font-semibold text-gray-900">{group.section}</h2>}<h3 className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><time dateTime={group.businessDate}>{date(group.businessDate)}</time></h3><div className="grid gap-3 sm:grid-cols-2">{group.orders.map(order => <article key={order.id} className={`flex min-w-0 flex-col rounded-xl border border-gray-200 p-4 shadow-md shadow-slate-200/60 transition-colors duration-200 sm:shadow-none ${orderBackground(order)}`}>
            <div className="mb-2 flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><Link href={`/orders/${order.id}`} className="break-all text-sm font-semibold text-indigo-700 hover:underline">{order.orderNo}</Link>{source(order)}</div><div className="mt-2"><OrderStatus order={order} copy={copy} branchName={showBranchName ? order.branchName : undefined} showPayment /></div></div><div className="min-w-0 max-w-[55%] text-right"><p className="font-bold tabular-nums text-gray-900">{money(order.totalAmount)}</p>{!order.isDraft && order.dueAmount > 0 && <p className="text-xs text-red-600">{copy.due} {money(order.dueAmount)}</p>}</div></div>
            {!showDetails && <p className="mb-3 text-sm text-gray-600">{copy.orderedQuantity}: <span className="font-semibold tabular-nums text-gray-900">{order.items.reduce((total, item) => total + item.qty, 0).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD")}</span></p>}
            {showDetails && <>
              <div className="my-1.5 rounded-lg border border-slate-200 px-3 py-1.5"><div className="flex flex-wrap items-center justify-between gap-1"><p className="text-sm font-semibold text-gray-800">{order.customerName}</p>{order.customerPhone && <a href={`tel:${order.customerPhone}`} className="text-xs text-gray-500">{order.customerPhone}</a>}</div>{order.customerAddress && <p className="mt-1 flex items-start gap-1 text-xs text-gray-500"><MapPinIcon className="size-3.5 shrink-0" /><span className="line-clamp-2">{order.customerAddress}</span></p>}</div>
              <div className="flex-1 rounded-lg bg-indigo-50 p-3 sm:rounded-none sm:border-y sm:border-gray-100 sm:bg-transparent sm:px-0"><Products order={order} copy={copy} /></div>
            </>}
            <div className="mt-1">{actions(order)}</div>
          </article>)}</div></section>)}</div>
          <footer className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-4 text-xs text-gray-500">
            <p>{copy.page} {currentPage} {copy.of} {pageCount}</p><div className="flex gap-2"><button className={button} disabled={currentPage <= 1 || isFetching} onClick={() => setPage(currentPage - 1)} aria-label={copy.previous}><ChevronLeftIcon className="size-4" /><span className="hidden sm:inline">{copy.previous}</span></button><button className={button} disabled={currentPage >= pageCount || isFetching} onClick={() => setPage(currentPage + 1)} aria-label={copy.next}><span className="hidden sm:inline">{copy.next}</span><ChevronRightIcon className="size-4" /></button></div>
          </footer>
        </>}
    </section>
    {showFilters && <Dialog title={copy.filters} close={() => setShowFilters(false)}><form className="space-y-5 p-5" onSubmit={event => { event.preventDefault(); if (!dateInvalid) { setFilters(draftFilters); setPage(1); setShowFilters(false); } }}>
      <div className="grid grid-cols-4 gap-2">{(["today", "7d", "30d", "3m"] as ReportPeriod[]).map(period => <button type="button" key={period} className={button} onClick={() => setDraftFilters({ ...draftFilters, ...periodToDates(period) })}>{period === "today" ? t("orders.today") : period.toUpperCase()}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">{(["from", "to"] as const).map(key => <label key={key} className="space-y-1.5 text-xs font-medium text-gray-600"><span>{copy[key]}</span><input type="date" className={input} value={draftFilters[key]} min={key === "to" ? draftFilters.from : undefined} onChange={event => setDraftFilters({ ...draftFilters, [key]: event.target.value })} /></label>)}</div>
      {dateInvalid && <p role="alert" className="text-xs text-red-600">{copy.dateError}</p>}
      <label className="block space-y-1.5 text-xs font-medium text-gray-600"><span>{copy.channel}</span><select aria-label={copy.channel} className={input} value={draftFilters.channel} onChange={event => setDraftFilters({ ...draftFilters, channel: event.target.value })}><option value="">{copy.allChannels}</option>{Object.entries(CHANNELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {(["customer", "product"] as const).map(key => <label key={key} className="block space-y-1.5 text-xs font-medium text-gray-600"><span>{copy[key]}</span><input className={input} value={draftFilters[key]} onChange={event => setDraftFilters({ ...draftFilters, [key]: event.target.value })} /></label>)}
      <div className="flex justify-between gap-3 border-t border-gray-100 pt-4"><button type="button" className={button} onClick={() => setDraftFilters(emptyFilters)}>{copy.clear}</button><button disabled={dateInvalid} className={`${primary} disabled:opacity-40`} type="submit">{copy.apply}</button></div>
    </form></Dialog>}
    {actionOrder && <SlidePanel open={Boolean(actionOrder)} title={`${actionOrder.orderNo} · ${copy.contactCustomer}`} onClose={() => setActionOrder(null)}><div className="flex flex-col gap-2 p-5">
      <section aria-label={copy.customer} className="mb-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-2 text-xs font-medium text-gray-500">{copy.customer}</h3>
        <p className="break-words text-sm font-semibold text-gray-900">{actionOrder.customerName}</p>
        {actionOrder.customerPhone && <p className="mt-1 break-words text-sm text-gray-600">{actionOrder.customerPhone}</p>}
        {actionOrder.customerAddress && <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600"><MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{actionOrder.customerAddress}</span></p>}
      </section>
      {!actionOrder.customerPhone && <p className="text-sm text-gray-500">{copy.noCustomerPhone}</p>}
      {actionOrder.customerPhone && <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <a className={`${primary} md:hidden`} href={`tel:${actionOrder.customerPhone}`}><PhoneIcon aria-hidden="true" className="size-4 shrink-0" />{copy.call}</a>
        <a className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2" href={`https://wa.me/${whatsAppNumber(actionOrder.customerPhone)}`} target="_blank" rel="noopener noreferrer"><ChatBubbleLeftRightIcon aria-hidden="true" className="size-4 shrink-0" />{copy.whatsapp}</a>
      </div>}
      {!actionOrder.isDraft && actionOrder.orderStatus !== "CANCELLED" && <Link className={button} href={`/more/reports/invoices/${actionOrder.id}`}>{copy.invoice}</Link>}
    </div></SlidePanel>}
  </div>;
}
