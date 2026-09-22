"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlassIcon, FunnelIcon, ArrowRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { listInvoices } from "@/lib/ordersApi";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/i18n/LanguageContext";

export default function InvoicesPage() {
  const { t, lang } = useLanguage();
  const businessId = useAuthStore((s) => s.currentBusinessId);
  const branchId = useAuthStore((s) => s.currentBranchId);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payment, setPayment] = useState("");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const invalidDates = Boolean(from && to && from > to);
  const filterCount = Number(Boolean(from || to)) + Number(Boolean(payment));

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["invoices", businessId, branchId, query, page, from, to, payment, today],
    queryFn: () => listInvoices(query, page, { from: from || undefined, to: to || undefined, payment: payment || undefined, today }),
    enabled: Boolean(businessId) && !invalidDates,
  });
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;
  const money = (value: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD", {
    style: "currency", currency: "BDT", maximumFractionDigits: 2,
  }).format(value);

  return (
    <div className="space-y-4 bg-slate-50 px-4 py-5">
      <header><h1 className="text-xl font-bold text-slate-900">{t("reports.menu.invoices")}</h1><p className="mt-1 text-sm text-slate-500">{t("reports.invoices.hint")}</p></header>
      <section aria-label={t("reports.invoices.todaySales")} className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-xs font-semibold text-indigo-700">{t("reports.invoices.todaySales")}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{data?.summary ? money(data.summary.total) : "—"}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-indigo-100 pt-3 text-xs">
          <div><dt className="text-slate-500">{t("orders.paid")}</dt><dd className="mt-1 font-semibold text-emerald-700 tabular-nums">{data?.summary ? money(data.summary.paid) : "—"}</dd></div>
          <div><dt className="text-slate-500">{t("orders.due")}</dt><dd className="mt-1 font-semibold text-amber-800 tabular-nums">{data?.summary ? money(data.summary.due) : "—"}</dd></div>
        </dl>
      </section>
      <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1">
        <MagnifyingGlassIcon aria-hidden="true" className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          aria-label={t("reports.invoices.search")} placeholder={t("reports.invoices.search")}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div><button type="button" aria-expanded={showFilters} aria-controls="invoice-filters" onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500"><FunnelIcon aria-hidden="true" className="size-4" />{t("reports.invoices.filters")}{filterCount > 0 && <span className="rounded bg-indigo-100 px-1.5 text-xs text-indigo-700">{filterCount}</span>}</button></div>
      {showFilters && <section id="invoice-filters" className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0 space-y-1 text-xs text-slate-600"><span>{t("reports.invoices.fromDate")}</span><input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(1); }} className="block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label>
          <label className="min-w-0 space-y-1 text-xs text-slate-600"><span>{t("reports.invoices.toDate")}</span><input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(1); }} className="block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label>
        </div>
        <label className="block space-y-1 text-xs text-slate-600"><span>{t("reports.invoices.paymentStatus")}</span><select value={payment} onChange={e => { setPayment(e.target.value); setPage(1); }} className="block w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"><option value="">{t("reports.invoices.allPayments")}</option><option value="paid">{t("orders.paid")}</option><option value="due">{t("orders.due")}</option></select></label>
        {filterCount > 0 && <button type="button" onClick={() => { setFrom(""); setTo(""); setPayment(""); setPage(1); }} className="text-xs font-semibold text-indigo-700">{t("reports.invoices.clearFilters")}</button>}
      </section>}
      {invalidDates ? <p role="alert" className="text-sm text-red-600">{t("reports.invoices.invalidDates")}</p> : isPending ? <p role="status">{t("common.loading")}</p> : isError ? (
        <div role="alert" className="space-y-2 text-sm text-red-600">
          <p>{t("reports.invoices.loadError")}</p>
          <button type="button" onClick={() => void refetch()} className="underline">{t("reports.invoices.retry")}</button>
        </div>
      ) : data && (
        <>
          {data.items.length === 0 && <p role="status" className="py-8 text-center text-gray-500">{t("reports.invoices.empty")}</p>}
          {data.items.map((invoice) => (
            <article key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/orders/${invoice.id}`} className="break-all text-base font-bold text-slate-900 hover:text-indigo-700">{invoice.orderNo}</Link>
                  <p className="mt-1 text-sm text-gray-700">{invoice.customerName || "—"}</p>
                </div>
                <time dateTime={invoice.businessDate} className="text-xs text-gray-500">{new Date(`${invoice.businessDate}T00:00:00`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{money(invoice.totalAmount)}</p>
                {invoice.dueAmount > 0 ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{t("orders.due")} {money(invoice.dueAmount)}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircleIcon aria-hidden="true" className="size-3.5" />{t("orders.paid")}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("orders.paid")}: <span className="tabular-nums">{money(invoice.totalPaid)}</span>{invoice.dueAmount < 0 && <span className="ml-3">{t("reports.invoices.credit")}: {money(-invoice.dueAmount)}</span>}</p>
              <div className="mt-3 border-t border-slate-100 pt-2">
              <Link href={`/more/reports/invoices/${invoice.id}`}
                aria-label={`${t("reports.invoices.viewInvoice")} ${invoice.orderNo}`} className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500">
                {t("reports.invoices.viewShort")}<ArrowRightIcon aria-hidden="true" className="size-3.5" />
              </Link>
              </div>
            </article>
          ))}
          {data.totalCount > 0 && (
            <nav aria-label={t("reports.menu.invoices")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <button type="button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t("reports.invoices.previous")}</button>
              <p role="status" className="text-xs text-gray-500">{t("reports.invoices.page", { page: data.page, pages, count: data.totalCount })}</p>
              <button type="button" disabled={data.page >= pages} onClick={() => setPage(data.page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t("reports.invoices.next")}</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
