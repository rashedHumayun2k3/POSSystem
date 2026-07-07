"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrdersReport } from "@/lib/reportsApi";
import DateRangeBar, { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useAuthStore } from "@/store/authStore";
import { useMounted } from "@/hooks/useMounted";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defective",
  WRONG_SIZE_COLOR: "Wrong Size/Color",
  CHANGED_MIND: "Changed Mind",
  DAMAGED_DELIVERY: "Damaged in Delivery",
  OTHER: "Other",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{children}</h2>;
}

export default function OrdersReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const mounted = useMounted();

  const { from, to } = periodToDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ["report-orders", from, to, groupBy, currentBranchId],
    queryFn: () => getOrdersReport({ from, to, groupBy }),
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
            {/* Status summary grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: data.totalOrders, color: "text-gray-900" },
                { label: "Completed", value: data.completedOrders, color: "text-emerald-600" },
                { label: "Pending", value: data.pendingOrders, color: "text-amber-600" },
                { label: "Cancelled", value: data.cancelledOrders, color: "text-red-600" },
                { label: "Returned", value: data.returnedOrders, color: "text-purple-600" },
                { label: "Return Rate", value: `${data.returnRate}%`, color: data.returnRate > 10 ? "text-red-600" : "text-gray-700" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                  <p className="text-[11px] text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Orders trend */}
            <SectionTitle>Orders Trend</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.ordersTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [Number(v ?? 0), "Orders"]} labelStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Cancellation trend */}
            {data.cancelledTrend.some((d) => d.value > 0) && (
              <>
                <SectionTitle>Cancellation Trend</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={data.cancelledTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [Number(v ?? 0), "Cancelled"]} labelStyle={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[3, 3, 0, 0]} name="Cancelled" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Orders by channel */}
            {data.ordersByChannel.length > 0 && (
              <>
                <SectionTitle>Orders by Channel</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={150}>
                    <PieChart>
                      <Pie data={data.ordersByChannel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                        {data.ordersByChannel.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [Number(v ?? 0), "Orders"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {data.ordersByChannel.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600 flex-1">{c.name}</span>
                        <span className="font-bold text-gray-800">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Return reasons */}
            {data.returnReasons.length > 0 && (
              <>
                <SectionTitle>Return Reasons</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={150}>
                    <PieChart>
                      <Pie data={data.returnReasons} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                        {data.returnReasons.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [Number(v ?? 0), "Returns"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {data.returnReasons.map((r, i) => (
                      <div key={r.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600 flex-1 truncate">{REASON_LABELS[r.name] ?? r.name}</span>
                        <span className="font-bold text-gray-800">{r.value}</span>
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
