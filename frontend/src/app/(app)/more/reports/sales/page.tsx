"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSalesSummary } from "@/lib/reportsApi";
import DateRangeBar, { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useAuthStore } from "@/store/authStore";
import { useMounted } from "@/hooks/useMounted";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{children}</h2>;
}

export default function SalesReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const mounted = useMounted();

  const { from, to } = periodToDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ["report-sales", from, to, groupBy, currentBranchId],
    queryFn: () => getSalesSummary({ from, to, groupBy }),
    staleTime: 60_000,
    enabled: mounted,
  });

  return (
    <div className="flex flex-col min-h-screen">
      <DateRangeBar period={period} onPeriod={setPeriod} groupBy={groupBy} onGroupBy={setGroupBy} />

      <div className="px-4 py-4 pb-10 flex-1">
        {(!mounted || isLoading) && <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>}
        {mounted && !isLoading && data && (
          <>
            {/* Summary metrics */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Total Revenue" value={`৳${data.totalRevenue.toLocaleString()}`} />
              <MetricCard label="Total Orders" value={data.totalOrders.toString()} />
              <MetricCard label="Avg. Order Value" value={`৳${data.averageOrderValue.toLocaleString()}`} />
              <MetricCard label="Total Discount" value={`৳${data.totalDiscount.toLocaleString()}`} />
            </div>

            {/* Revenue trend */}
            <SectionTitle>Revenue Trend</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.revenueByPeriod} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`৳${Number(v ?? 0).toLocaleString()}`, "Revenue"]} labelStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly distribution */}
            <SectionTitle>Hourly Sales Distribution</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data.hourlySales} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={3} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`৳${Number(v ?? 0).toLocaleString()}`, "Sales"]} labelStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top products */}
            {data.topProducts.length > 0 && (
              <>
                <SectionTitle>Top Products by Revenue</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <ResponsiveContainer width="100%" height={Math.max(140, data.topProducts.length * 28)}>
                    <BarChart layout="vertical" data={data.topProducts} margin={{ top: 0, right: 30, left: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v) => [`৳${Number(v ?? 0).toLocaleString()}`, "Revenue"]} labelStyle={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* By category */}
            {data.byCategory.length > 0 && (
              <>
                <SectionTitle>Sales by Category</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={data.byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                        {data.byCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {data.byCategory.map((c, i) => (
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

            {/* By cashier */}
            {data.byCashier.length > 0 && (
              <>
                <SectionTitle>Sales by Cashier</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                  {data.byCashier.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className="w-5 text-gray-400 text-xs font-bold">{i + 1}</span>
                      <span className="flex-1 text-gray-800">{c.name}</span>
                      <span className="font-semibold text-indigo-600">৳{c.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Payment methods */}
            {data.byPaymentMethod.length > 0 && (
              <>
                <SectionTitle>Payment Method Distribution</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={140}>
                    <PieChart>
                      <Pie data={data.byPaymentMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                        {data.byPaymentMethod.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {data.byPaymentMethod.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600 truncate flex-1">{m.name}</span>
                        <span className="font-medium text-gray-800 shrink-0">৳{m.value.toLocaleString()}</span>
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
