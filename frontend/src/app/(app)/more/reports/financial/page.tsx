"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPnlReport } from "@/lib/reportsApi";
import DateRangeBar, { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useAuthStore } from "@/store/authStore";
import { useMounted } from "@/hooks/useMounted";
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

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

  const { from, to } = periodToDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ["report-financial", from, to, groupBy, currentBranchId],
    queryFn: () => getPnlReport({ from, to, groupBy }),
    staleTime: 60_000,
    enabled: mounted,
  });

  return (
    <div className="flex flex-col min-h-screen">
      <DateRangeBar period={period} onPeriod={setPeriod} groupBy={groupBy} onGroupBy={setGroupBy} />

      <div className="px-4 py-4 pb-10">
        {(!mounted || isLoading) && <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>}
        {mounted && !isLoading && data && (
          <>
            {/* P&L Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Profit & Loss Summary</p>
              <PnlRow label="Revenue" value={data.revenue} highlight="blue" />
              <PnlRow label="Cost of Goods (COGS)" value={data.cogs} highlight="gray" />
              <PnlRow label="Gross Profit" value={data.grossProfit} pct={data.grossMarginPct} highlight={data.grossProfit >= 0 ? "green" : "red"} />
              <PnlRow label="Total Expenses" value={data.totalExpenses} highlight="red" />
              <div className={`mt-2 pt-2 border-t-2 ${data.netProfit >= 0 ? "border-emerald-200" : "border-red-200"}`}>
                <PnlRow label="Net Profit" value={data.netProfit} pct={data.netMarginPct} highlight={data.netProfit >= 0 ? "green" : "red"} />
              </div>
            </div>

            {/* Also show discount */}
            {data.totalDiscount > 0 && (
              <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3 flex justify-between text-sm">
                <span className="text-amber-700">Discounts Given</span>
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
            <><SectionTitle>Revenue vs Profit Trend</SectionTitle>
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
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revG)" strokeWidth={2} dot={false} name="Revenue" />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profG)" strokeWidth={2} dot={false} name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div></>
              );
            })()}

            {/* Expense trend */}
            {data.expenseTrend.some((d) => d.value > 0) && (
              <>
                <SectionTitle>Expense Trend</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.expenseTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => [`৳${Number(v ?? 0).toLocaleString()}`, "Expenses"]} labelStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Expense by category */}
            {data.expenseByCategory.length > 0 && (
              <>
                <SectionTitle>Expenses by Category</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={data.expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                        {data.expenseByCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {data.expenseByCategory.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600 truncate flex-1">{c.name}</span>
                        <span className="font-medium text-gray-800 shrink-0">৳{c.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
