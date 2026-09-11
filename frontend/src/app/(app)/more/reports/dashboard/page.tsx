"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/reportsApi";
import { useAuthStore } from "@/store/authStore";
import { useMounted } from "@/hooks/useMounted";
import {
  LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function KpiCard({ label, value, sub, color = "indigo" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const ring = color === "green" ? "bg-emerald-50 border-emerald-100" : color === "red" ? "bg-red-50 border-red-100" : color === "amber" ? "bg-amber-50 border-amber-100" : "bg-indigo-50 border-indigo-100";
  const txt = color === "green" ? "text-emerald-700" : color === "red" ? "text-red-700" : color === "amber" ? "text-amber-700" : "text-indigo-700";
  return (
    <div className={`rounded-2xl border p-3 ${ring}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${txt} opacity-70`}>{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${txt}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{children}</h2>;
}

export default function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canSeeCosts = role === "OWNER" || role === "MANAGER";
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const mounted = useMounted();

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-dashboard", currentBranchId],
    queryFn: () => getDashboard(),
    staleTime: 60_000,
    enabled: mounted,
  });

  if (!mounted || isLoading) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>;
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-sm">
      <span className="text-red-400">Failed to load dashboard data</span>
      <span className="text-gray-400 text-xs">{(error as Error)?.message ?? "Unknown error"}</span>
    </div>
  );

  return (
    <div className="px-4 py-4 pb-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Today's Sales" value={`৳${data.todaySales.toLocaleString()}`} />
        <KpiCard label="Today's Orders" value={data.todayOrders} color="green" />
        {canSeeCosts && <KpiCard label="Today's Profit" value={`৳${data.todayProfit.toLocaleString()}`} color="amber" />}
        <KpiCard label="Customers" value={data.todayCustomers} />
        <KpiCard label="Products Sold" value={data.todayProductsSold} color="green" />
        <KpiCard label="Returns" value={data.todayReturns} color={data.todayReturns > 0 ? "red" : "indigo"} />
        <KpiCard label="Low Stock" value={data.lowStockCount} color={data.lowStockCount > 0 ? "amber" : "indigo"} sub="items" />
        <KpiCard label="Out of Stock" value={data.outOfStockCount} color={data.outOfStockCount > 0 ? "red" : "indigo"} sub="variants" />
      </div>

      {/* Sales Trend */}
      <SectionTitle>Sales Trend — Last 30 Days</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 p-3">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data.salesTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => [`৳${Number(v ?? 0).toLocaleString()}`, "Sales"]} labelStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Sales */}
      <SectionTitle>Hourly Sales — Today</SectionTitle>
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

      {/* Top Products */}
      {data.topProducts.length > 0 && (
        <>
          <SectionTitle>Top 10 Products — Last 30 Days</SectionTitle>
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <ResponsiveContainer width="100%" height={Math.max(160, data.topProducts.length * 28)}>
              <BarChart layout="vertical" data={data.topProducts} margin={{ top: 5, right: 30, left: 5, bottom: 0 }}>
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

      {/* Payment Methods */}
      {data.paymentMethods.length > 0 && (
        <>
          <SectionTitle>Payment Methods — Last 30 Days</SectionTitle>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={data.paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {data.paymentMethods.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {data.paymentMethods.map((m, i) => (
                <div key={m.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 truncate">{m.name}</span>
                  <span className="ml-auto font-medium text-gray-800">৳{m.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Sales by Category */}
      {data.salesByCategory.length > 0 && (
        <>
          <SectionTitle>Sales by Category — Last 30 Days</SectionTitle>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={data.salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {data.salesByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {data.salesByCategory.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 truncate">{c.name}</span>
                  <span className="ml-auto font-medium text-gray-800">৳{c.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
