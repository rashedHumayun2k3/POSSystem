"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPnlReport } from "@/lib/reportsApi";
import DateRangeBar, { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useAuthStore } from "@/store/authStore";
import { useMounted } from "@/hooks/useMounted";
import { useLanguage, type Lang } from "@/i18n/LanguageContext";
import ExpenseCategoryBreakdown from "@/components/reports/ExpenseCategoryBreakdown";
import {
  AreaChart, Area, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const TEXT: Record<Lang, Record<string, string>> = {
  en: {
    loading: "Loading...",
    summary: "Profit & Loss Summary",
    revenue: "Revenue",
    cogs: "Cost of Goods (COGS)",
    grossProfit: "Gross Profit",
    totalExpenses: "Total Expenses",
    netProfit: "Net Profit",
    discounts: "Discounts Given",
    revenueProfitTrend: "Revenue vs Profit Trend",
    expenseTrend: "Expense Trend",
    expenses: "Expenses",
    profit: "Profit",
  },
  bn: {
    loading: "লোড হচ্ছে...",
    summary: "লাভ-লোকসানের সারাংশ",
    revenue: "মোট বিক্রি",
    cogs: "মালের কেনা খরচ",
    grossProfit: "মোট লাভ",
    totalExpenses: "মোট খরচ",
    netProfit: "নিট লাভ",
    discounts: "ডিসকাউন্ট দেওয়া হয়েছে",
    revenueProfitTrend: "বিক্রি ও লাভের চলতি হিসাব",
    expenseTrend: "খরচের চলতি হিসাব",
    expenses: "খরচ",
    profit: "লাভ",
  },
};

function PnlRow({ label, value, pct, highlight }: { label: string; value: number; pct?: number; highlight?: "green" | "red" | "blue" | "gray" }) {
  const clr = highlight === "green" ? "text-emerald-600" : highlight === "red" ? "text-red-600" : highlight === "blue" ? "text-indigo-600" : "text-gray-800";
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${clr}`}>৳{value.toLocaleString()}</span>
        {pct !== undefined && <span className="text-xs text-gray-400 ml-1">({pct}%)</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{children}</h2>;
}

export default function FinancialReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const mounted = useMounted();
  const { lang } = useLanguage();
  const label = TEXT[lang];

  const { from, to } = periodToDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ["report-financial", from, to, groupBy, currentBranchId],
    queryFn: () => getPnlReport({ from, to, groupBy }),
    staleTime: 60_000,
    enabled: mounted,
  });

  return (
    <div className="flex flex-col min-h-full">
      <DateRangeBar period={period} onPeriod={setPeriod} groupBy={groupBy} onGroupBy={setGroupBy} />

      <div className="px-4 py-4 pb-10">
        {(!mounted || isLoading) && <div className="flex items-center justify-center h-40 text-gray-400 text-sm">{label.loading}</div>}
        {mounted && !isLoading && data && (
          <>
            {/* P&L Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{label.summary}</p>
              <PnlRow label={label.revenue} value={data.revenue} highlight="blue" />
              <PnlRow label={label.cogs} value={data.cogs} highlight="gray" />
              <PnlRow label={label.grossProfit} value={data.grossProfit} pct={data.grossMarginPct} highlight={data.grossProfit >= 0 ? "green" : "red"} />
              <PnlRow label={label.totalExpenses} value={data.totalExpenses} highlight="red" />
              <div className={`mt-2 pt-2 border-t-2 ${data.netProfit >= 0 ? "border-emerald-200" : "border-red-200"}`}>
                <PnlRow label={label.netProfit} value={data.netProfit} pct={data.netMarginPct} highlight={data.netProfit >= 0 ? "green" : "red"} />
              </div>
            </div>

            {/* Also show discount */}
            {data.totalDiscount > 0 && (
              <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3 flex justify-between text-sm">
                <span className="text-amber-700">{label.discounts}</span>
                <span className="font-semibold text-amber-700">৳{data.totalDiscount.toLocaleString()}</span>
              </div>
            )}

            {/* Revenue trend */}
            {(() => {
              const combinedTrend = data.revenueTrend.map((r, i) => ({
                label: r.label,
                revenue: r.value,
                profit: data.profitTrend[i]?.value ?? 0,
              }));
              return (
            <><SectionTitle>{label.revenueProfitTrend}</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={combinedTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} labelStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revG)" strokeWidth={2} dot={false} name={label.revenue} />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profG)" strokeWidth={2} dot={false} name={label.profit} />
                </AreaChart>
              </ResponsiveContainer>
            </div></>
              );
            })()}

            {/* Expense trend */}
            {data.expenseTrend.some((d) => d.value > 0) && (
              <>
                <SectionTitle>{label.expenseTrend}</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.expenseTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => [`৳${Number(v ?? 0).toLocaleString()}`, label.expenses]} labelStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            <ExpenseCategoryBreakdown categories={data.expenseByCategory} />
          </>
        )}
      </div>
    </div>
  );
}
