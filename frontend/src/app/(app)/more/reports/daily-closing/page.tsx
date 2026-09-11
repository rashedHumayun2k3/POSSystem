"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownTrayIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { downloadDailyClosingReportPdf, getDailyClosingReport, sendDailyClosingReport } from "@/lib/reportsApi";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DailyClosingLowStock, DailyClosingPurchaseItem, DailyClosingSoldProduct } from "@/types/reports";

function todayInputValue() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function money(value: number) {
  return `৳${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function qty(value: number) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function productLabel(name: string, variant?: string | null) {
  return variant ? `${name} (${variant})` : name;
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" }) {
  const toneClass = tone === "good" ? "bg-emerald-50 border-emerald-100" : tone === "warn" ? "bg-amber-50 border-amber-100" : "bg-white border-gray-100";
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function SoldRow({ item }: { item: DailyClosingSoldProduct }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{productLabel(item.productName, item.variantLabel)}</p>
          <p className="text-xs text-gray-400">SKU: {item.sku} · Qty {qty(item.qty)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">{money(item.revenue)}</p>
          <p className="text-xs text-emerald-600">{money(item.profit)} profit</p>
        </div>
      </div>
    </div>
  );
}

function LowStockRow({ item }: { item: DailyClosingLowStock }) {
  return (
    <div className="bg-white border border-amber-100 rounded-xl px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{productLabel(item.productName, item.variantLabel)}</p>
        <p className="text-xs text-gray-400">SKU: {item.sku}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-amber-700">{qty(item.quantity)}</p>
        <p className="text-[11px] text-gray-400">reorder {qty(item.reorderLevel)}</p>
      </div>
    </div>
  );
}

function PurchaseRow({ item }: { item: DailyClosingPurchaseItem }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{productLabel(item.productName, item.variantLabel)}</p>
        <p className="text-xs text-gray-400">SKU: {item.sku} · Qty {qty(item.qty)}</p>
      </div>
      <p className="text-sm font-semibold text-gray-900 shrink-0">{money(item.totalCost)}</p>
    </div>
  );
}

export default function DailyClosingReportPage() {
  const { lang } = useLanguage();
  const [date, setDate] = useState(todayInputValue());
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["daily-closing-report", date, currentBranchId],
    queryFn: () => getDailyClosingReport({ date }),
    staleTime: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: () => sendDailyClosingReport({ date, lang }),
    onSuccess: (res) => useToastStore.getState().show(res.message),
    onError: (err) => useToastStore.getState().show(getErrorMessage(err, "Could not send report email."), "error"),
  });

  const pdfMutation = useMutation({
    mutationFn: () => downloadDailyClosingReportPdf({ date, lang }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-closing-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (err) => useToastStore.getState().show(getErrorMessage(err, "Could not download PDF."), "error"),
  });

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <EnvelopeIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Daily Summary Report</p>
            <p className="text-xs text-gray-400">
              {data ? `${data.businessName} · Branch: ${data.branchName}` : "Email body plus professional PDF attachment"}
            </p>
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {isLoading && <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading...</div>}

      {!isLoading && data && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Today Sales" value={money(data.totalSales)} tone="good" />
            <MetricCard label="Total Profit" value={money(data.totalProfit)} tone="good" />
            <MetricCard label="Baki / Due" value={money(data.totalDue)} tone="warn" />
            <MetricCard label="Purchase" value={money(data.purchaseTotal)} />
            <MetricCard label="Orders" value={data.ordersReceived.toString()} />
            <MetricCard label="Low Stock" value={data.lowStockProducts.length.toString()} tone="warn" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="h-12 rounded-xl bg-sky-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <EnvelopeIcon className="w-4 h-4" />
              {sendMutation.isPending ? "Sending..." : "Send Email"}
            </button>
            <button
              type="button"
              onClick={() => pdfMutation.mutate()}
              disabled={pdfMutation.isPending}
              className="h-12 rounded-xl bg-white border border-gray-200 text-gray-800 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {pdfMutation.isPending ? "Preparing..." : "PDF"}
            </button>
          </div>

          <Section title="Order Summary">
            <div className="grid grid-cols-4 gap-2">
              <MetricCard label="Got" value={data.ordersReceived.toString()} />
              <MetricCard label="Delivered" value={data.ordersDelivered.toString()} />
              <MetricCard label="Returned" value={data.ordersReturned.toString()} tone="warn" />
              <MetricCard label="Cancel" value={data.ordersCancelled.toString()} />
            </div>
          </Section>

          {data.paymentMethods.length > 0 && (
            <Section title="Payment Breakdown">
              <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
                {data.paymentMethods.map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-600">{p.name}</span>
                    <span className="font-semibold text-gray-900">{money(p.value)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Selling Product List">
            {data.soldProducts.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-xl px-3 py-4">No products sold for this date.</p>
            ) : (
              <div className="space-y-2">{data.soldProducts.slice(0, 12).map((item) => <SoldRow key={`${item.sku}-${item.productName}`} item={item} />)}</div>
            )}
          </Section>

          <Section title="Current Low Quantity Product List">
            {data.lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-xl px-3 py-4">No low stock products right now.</p>
            ) : (
              <div className="space-y-2">{data.lowStockProducts.slice(0, 12).map((item) => <LowStockRow key={item.sku} item={item} />)}</div>
            )}
          </Section>

          <Section title="Purchase Summary">
            {data.purchaseItems.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-xl px-3 py-4">No completed purchases for this date.</p>
            ) : (
              <div className="space-y-2">{data.purchaseItems.slice(0, 12).map((item) => <PurchaseRow key={`${item.sku}-${item.productName}`} item={item} />)}</div>
            )}
          </Section>

          <button type="button" onClick={() => refetch()} className="w-full text-xs text-gray-400 py-2">
            Refresh report
          </button>
        </>
      )}
    </div>
  );
}
