"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInventoryReport } from "@/lib/reportsApi";
import DateRangeBar, { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useAuthStore } from "@/store/authStore";
import { formatVariantLabel } from "@/lib/format";
import { useMounted } from "@/hooks/useMounted";
import {
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const TABS = ["status", "movements", "fast", "slow"] as const;
type Tab = typeof TABS[number];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{children}</h2>;
}

export default function InventoryReportPage() {
  const [tab, setTab] = useState<Tab>("status");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const role = useAuthStore((s) => s.user?.role);
  const canSeeCosts = role === "OWNER" || role === "MANAGER";
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const mounted = useMounted();

  const { from, to } = periodToDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory", from, to, groupBy, currentBranchId],
    queryFn: () => getInventoryReport({ from, to, groupBy }),
    staleTime: 120_000,
    enabled: mounted,
  });

  if (!mounted || isLoading) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-40 text-red-400 text-sm">Failed to load</div>;

  const filteredItems = data.items.filter((i) =>
    i.productName.toLowerCase().includes(search.toLowerCase()) ||
    i.variantSku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Summary strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-base font-bold text-gray-900">{data.totalVariants}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Low Stock</p>
          <p className={`text-base font-bold ${data.lowStockCount > 0 ? "text-amber-600" : "text-gray-900"}`}>{data.lowStockCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Out of Stock</p>
          <p className={`text-base font-bold ${data.outOfStockCount > 0 ? "text-red-600" : "text-gray-900"}`}>{data.outOfStockCount}</p>
        </div>
        {canSeeCosts && (
          <div>
            <p className="text-xs text-gray-400">Value</p>
            <p className="text-base font-bold text-indigo-600">৳{(data.totalInventoryValue / 1000).toFixed(0)}k</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 bg-white overflow-x-auto no-scrollbar border-b border-gray-100">
        {[
          { key: "status" as Tab, label: "Stock Status" },
          { key: "movements" as Tab, label: "Movements" },
          { key: "fast" as Tab, label: "Fast Moving" },
          { key: "slow" as Tab, label: "Slow Moving" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t.key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "status" && (
        <DateRangeBar period={period} onPeriod={setPeriod} groupBy={groupBy} onGroupBy={setGroupBy} />
      )}

      <div className="px-4 py-4 pb-10">
        {/* Stock Status Tab */}
        {tab === "status" && (
          <>
            <input
              type="text"
              placeholder="Search product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="space-y-1">
              {filteredItems.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No items found</p>
              )}
              {filteredItems.map((item) => (
                <div key={item.variantSku} className={`bg-white rounded-xl border p-3 ${
                  item.isOutOfStock ? "border-red-200 bg-red-50" : item.isLowStock ? "border-amber-200 bg-amber-50" : "border-gray-100"
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      {formatVariantLabel(item.variantLabel) && (
                        <p className="text-xs text-gray-400">{formatVariantLabel(item.variantLabel)}</p>
                      )}
                      <p className="text-xs text-gray-400">{item.variantSku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-bold ${item.isOutOfStock ? "text-red-600" : item.isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                        {item.onHand}
                      </p>
                      {item.isOutOfStock && <span className="text-[10px] text-red-500 font-semibold">OUT OF STOCK</span>}
                      {item.isLowStock && !item.isOutOfStock && <span className="text-[10px] text-amber-600 font-semibold">LOW STOCK</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[11px] text-gray-400">
                    <span>Available: <b className="text-gray-700">{item.available}</b></span>
                    {item.damaged > 0 && <span>Damaged: <b className="text-red-500">{item.damaged}</b></span>}
                    <span>Reorder: <b className="text-gray-700">{item.reorderLevel}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Movements Tab */}
        {tab === "movements" && (
          <>
            <SectionTitle>Net Stock Movement</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-2">Purchases (positive) vs Sales (negative)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.movementTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip labelStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} name="Net Qty" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Fast Moving Tab */}
        {tab === "fast" && (
          <>
            <SectionTitle>Fast Moving Products</SectionTitle>
            {data.fastMovingProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No sales data yet</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-3">
                <ResponsiveContainer width="100%" height={Math.max(160, data.fastMovingProducts.length * 30)}>
                  <BarChart layout="vertical" data={data.fastMovingProducts} margin={{ top: 0, right: 30, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => [`${Number(v ?? 0)} units`, "Qty Sold"]} labelStyle={{ fontSize: 11 }} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 3, 3, 0]} name="Qty Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Slow Moving Tab */}
        {tab === "slow" && (
          <>
            <SectionTitle>Slow Moving Products</SectionTitle>
            {data.slowMovingProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-3">
                <ResponsiveContainer width="100%" height={Math.max(160, data.slowMovingProducts.length * 30)}>
                  <BarChart layout="vertical" data={data.slowMovingProducts} margin={{ top: 0, right: 30, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => [`${Number(v ?? 0)} units`, "Qty Sold"]} labelStyle={{ fontSize: 11 }} />
                    <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]} name="Qty Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
