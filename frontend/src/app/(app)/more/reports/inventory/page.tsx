"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInventoryReport } from "@/lib/reportsApi";
import DateRangeBar, { periodToDates } from "@/components/reports/DateRangeBar";
import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useAuthStore } from "@/store/authStore";
import { formatVariantLabel } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media";
import { useMounted } from "@/hooks/useMounted";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Tab = "status" | "low" | "movements" | "fast" | "slow";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{children}</h2>;
}

export default function InventoryReportPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "status";
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    return requestedTab && ["status", "low", "movements", "fast", "slow"].includes(requestedTab)
      ? requestedTab as Tab
      : "status";
  });
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
  const lowStockItems = filteredItems
    .filter((i) => i.isLowStock || i.isOutOfStock)
    .sort((a, b) => {
      if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
      return a.available - b.available || a.productName.localeCompare(b.productName);
    });
  const totalShortageQty = lowStockItems.reduce((sum, item) => sum + Math.max(0, item.reorderLevel - item.available), 0);

  return (
    <div className="flex flex-col min-h-full">
      {/* Summary strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xs text-gray-400">{t("reports.inventory.total")}</p>
          <p className="text-base font-bold text-gray-900">{data.totalVariants}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">{t("reports.inventory.lowStock")}</p>
          <p className={`text-base font-bold ${data.lowStockCount > 0 ? "text-amber-600" : "text-gray-900"}`}>{data.lowStockCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">{t("reports.inventory.outOfStock")}</p>
          <p className={`text-base font-bold ${data.outOfStockCount > 0 ? "text-red-600" : "text-gray-900"}`}>{data.outOfStockCount}</p>
        </div>
        {canSeeCosts && (
          <div>
            <p className="text-xs text-gray-400">{t("reports.inventory.value")}</p>
            <p className="text-base font-bold text-indigo-600">৳{(data.totalInventoryValue / 1000).toFixed(0)}k</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 bg-white overflow-x-auto no-scrollbar border-b border-gray-100">
        {[
          { key: "status" as Tab, label: t("reports.inventory.stockStatus") },
          { key: "low" as Tab, label: t("reports.inventory.lowStockReport") },
          { key: "movements" as Tab, label: t("reports.inventory.movements") },
          { key: "fast" as Tab, label: t("reports.inventory.fastMoving") },
          { key: "slow" as Tab, label: t("reports.inventory.slowMoving") },
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

      {tab !== "status" && tab !== "low" && (
        <DateRangeBar period={period} onPeriod={setPeriod} groupBy={groupBy} onGroupBy={setGroupBy} />
      )}

      <div className="px-4 py-4 pb-10">
        {(tab === "status" || tab === "low") && (
          <input
            type="text"
            placeholder={t("reports.inventory.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        )}

        {/* Low Stock Report Tab */}
        {tab === "low" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-[11px] text-red-500 uppercase font-semibold">{t("reports.inventory.outOfStock")}</p>
                <p className="text-lg font-bold text-red-700">{data.outOfStockCount} <span className="text-[10px] font-medium text-red-500">{t("reports.inventory.productUnit")}</span></p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <p className="text-[11px] text-amber-600 uppercase font-semibold">{t("reports.inventory.lowStock")}</p>
                <p className="text-lg font-bold text-amber-700">{data.lowStockCount} <span className="text-[10px] font-medium text-amber-600">{t("reports.inventory.productUnit")}</span></p>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-center">
                <p className="text-[11px] text-sky-600 uppercase font-semibold">{t("reports.inventory.needQty")}</p>
                <p className="text-lg font-bold text-sky-800">{totalShortageQty} <span className="text-[10px] font-medium text-sky-600">{t("reports.inventory.quantityUnit")}</span></p>
              </div>
            </div>

            <SectionTitle>{t("reports.inventory.productsNeedRestock")}</SectionTitle>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8 bg-white border border-gray-100 rounded-2xl">{t("reports.inventory.noLowStockProducts")}</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map((item) => {
                  const imageUrl = resolveMediaUrl(item.imageUrl);
                  return (
                    <div
                      key={item.variantSku}
                      className={`rounded-xl border p-3 flex items-center gap-3 ${
                        item.isOutOfStock ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="w-14 h-14 rounded-xl bg-white border border-white/70 overflow-hidden shrink-0 flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-gray-300">{item.productName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${item.isOutOfStock ? "bg-red-500" : "bg-amber-500"}`} />
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                        </div>
                        {formatVariantLabel(item.variantLabel) && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{formatVariantLabel(item.variantLabel)}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">SKU: {item.variantSku}</p>
                        {item.barcode && <p className="text-xs text-gray-400 mt-0.5">Barcode: {item.barcode}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xl font-bold ${item.isOutOfStock ? "text-red-700" : "text-amber-700"}`}>{item.available}</p>
                        <p className="text-[10px] text-gray-500">{t("reports.inventory.currentStock")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Stock Status Tab */}
        {tab === "status" && (
          <>
            <div className="space-y-1">
              {filteredItems.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No items found</p>
              )}
              {filteredItems.map((item) => {
                const imageUrl = resolveMediaUrl(item.imageUrl);
                return (
                  <div key={item.variantSku} className={`bg-white rounded-xl border p-3 ${
                    item.isOutOfStock ? "border-red-200 bg-red-50" : item.isLowStock ? "border-amber-200 bg-amber-50" : "border-gray-100"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base font-bold text-gray-300">{item.productName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        {formatVariantLabel(item.variantLabel) && (
                          <p className="text-xs text-gray-400 truncate">{formatVariantLabel(item.variantLabel)}</p>
                        )}
                        <p className="text-xs text-gray-400">{item.variantSku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-base font-bold ${item.isOutOfStock ? "text-red-600" : item.isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                          {item.available}
                        </p>
                        {item.isOutOfStock && <span className="text-[10px] text-red-500 font-semibold">{t("reports.inventory.outOfStock")}</span>}
                        {item.isLowStock && !item.isOutOfStock && <span className="text-[10px] text-amber-600 font-semibold">{t("reports.inventory.lowStock")}</span>}
                      </div>
                    </div>
                    {(item.damaged > 0 || item.allocated > 0) && (
                      <div className="flex gap-3 mt-1.5 text-[11px] text-gray-400 pl-[60px]">
                        {item.allocated > 0 && <span>{t("reports.inventory.allocated")}: <b className="text-gray-700">{item.allocated}</b></span>}
                        {item.damaged > 0 && <span>{t("reports.inventory.damaged")}: <b className="text-red-500">{item.damaged}</b></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Movements Tab */}
        {tab === "movements" && (
          <>
            <SectionTitle>{t("reports.inventory.netStockMovement")}</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-2">{t("reports.inventory.movementHint")}</p>
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
            <SectionTitle>{t("reports.inventory.fastMovingProducts")}</SectionTitle>
            {data.fastMovingProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No sales data yet</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <ResponsiveContainer width="100%" height={Math.max(160, data.fastMovingProducts.length * 30)}>
                    <BarChart layout="vertical" data={data.fastMovingProducts} margin={{ top: 0, right: 30, left: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 9 }} />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v) => [`${Number(v ?? 0)} ${t("reports.inventory.units")}`, t("reports.inventory.qtySold")]} labelStyle={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 3, 3, 0]} name={t("reports.inventory.qtySold")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                  {data.fastMovingProducts.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-700 shrink-0">{Number(item.value ?? 0)} {t("reports.inventory.units")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Slow Moving Tab */}
        {tab === "slow" && (
          <>
            <SectionTitle>{t("reports.inventory.slowMovingProducts")}</SectionTitle>
            {data.slowMovingProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <ResponsiveContainer width="100%" height={Math.max(160, data.slowMovingProducts.length * 30)}>
                    <BarChart layout="vertical" data={data.slowMovingProducts} margin={{ top: 0, right: 30, left: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 9 }} />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v) => [`${Number(v ?? 0)} ${t("reports.inventory.units")}`, t("reports.inventory.qtySold")]} labelStyle={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]} name={t("reports.inventory.qtySold")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                  {data.slowMovingProducts.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-red-50 text-red-700 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      </div>
                      <p className="text-sm font-bold text-red-700 shrink-0">{Number(item.value ?? 0)} {t("reports.inventory.units")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
