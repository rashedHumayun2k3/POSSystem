"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrder, addOrderPayment } from "@/lib/ordersApi";
import { enqueueOfflineSale, isNetworkError } from "@/lib/posSync";
import { browseProductsWithFallback, getTodaySoldWithFallback, useCatalogAutoSync } from "@/lib/localDb/catalogCache";
import { resolveMediaUrl } from "@/lib/media";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import type { ProductSearchResult } from "@/types/catalog";
import CustomerPickerSlide, { type SelectedCustomer } from "@/components/orders/CustomerPickerSlide";
import CustomerSummaryRow from "@/components/orders/CustomerSummaryRow";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Some product names carry a baked-in "(32% Off)" suffix (seed/demo data) — the price rows
// already show the real, live discount, so strip the duplicate wherever the name is displayed.
function stripDiscountSuffix(name: string): string {
  return name.replace(/\s*\(\s*\d+%\s*off\s*\)\s*$/i, "").trim();
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: string; items?: string[] } } })?.response;
  if (response?.data?.items?.length) return `${response.data.message ?? fallback}\n${response.data.items.join("\n")}`;
  if (response?.data?.message) return response.data.message;
  return fallback;
}

export default function NightEntryPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const canSeeCosts = useAuthStore((s) => s.canSeeCosts);
  useCatalogAutoSync();

  const [date, setDate] = useState(todayStr());
  const [active, setActive] = useState<ProductSearchResult | null>(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionProfit, setSessionProfit] = useState(0);
  // Additive per-variant tally of sales made this session — merged on top of whatever
  // todaySold/stock the query returned so the tile grid reflects a just-made sale immediately,
  // whether it synced right away or is still sitting in the offline queue (which won't show up in
  // a server-computed "today sold" figure until it actually syncs).
  const [sessionSoldDelta, setSessionSoldDelta] = useState<Record<string, number>>({});
  const [addCustomer, setAddCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["hawker-night-entry-products"],
    queryFn: () => browseProductsWithFallback(undefined, true),
  });

  const { data: todaySold = {} } = useQuery({
    queryKey: ["hawker-night-entry-today-sold"],
    queryFn: getTodaySoldWithFallback,
    staleTime: 15_000,
  });

  const openTile = (p: ProductSearchResult) => {
    setActive(p);
    setPrice(String(p.sellingPrice));
    setQty(1);
    setNote("");
    setAddCustomer(false);
    setSelectedCustomer(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!active) return { total: 0, profit: 0, variantId: "", qty: 0, offline: false };
      const unitPrice = parseFloat(price) || 0;
      const total = unitPrice * qty;
      // Landed-cost based, same as the tile's avgLandedCost — an approximation (no packaging
      // cost subtracted, unlike the backend's report/dashboard profit figures) good enough for a
      // running session total; Owner/Manager only, never sent to STAFF's eyes (see canSeeCosts gate below).
      const profit = (unitPrice - active.avgLandedCost) * qty;
      const saleId = crypto.randomUUID();

      try {
        // isDraft:false makes createOrder also confirm (commit stock) in the same call — no
        // separate confirm step, same fix already applied to the regular POS checkout flow.
        const order = await createOrder({
          channel: "HAWKER",
          customerPhone: selectedCustomer?.phone || "00000000000",
          customerName: selectedCustomer?.name || "Walk-in",
          customerAddress: selectedCustomer?.address || undefined,
          isDraft: false,
          items: [{ variantId: active.variantId, qty, unitPrice }],
          deliveryChargeCustomer: 0,
          advancePaid: 0,
          note: note.trim() || undefined,
          clientUid: saleId,
          businessDate: date,
        });
        await addOrderPayment(order.id, { method: "CASH", amount: total });
        return { total, profit, variantId: active.variantId, qty, offline: false };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // No network — queue the sale locally instead of blocking the seller. saleId doubles as
        // the eventual order's Idempotency-Key/ClientUid, same pattern the regular POS offline
        // queue uses (see lib/posSync.ts).
        await enqueueOfflineSale({
          id: saleId,
          channel: "HAWKER",
          customerName: selectedCustomer?.name || "Walk-in",
          customerPhone: selectedCustomer?.phone || "00000000000",
          items: [{ variantId: active.variantId, qty, unitPrice }],
          note: note.trim() || undefined,
          method: "CASH",
          paidAmount: total,
          total,
          businessDate: date,
          createdAt: Date.now(),
        });
        return { total, profit, variantId: active.variantId, qty, offline: true };
      }
    },
    onSuccess: ({ total, profit, variantId, qty: soldQty, offline }) => {
      setSessionCount((c) => c + 1);
      setSessionTotal((sum) => sum + total);
      setSessionProfit((sum) => sum + profit);
      if (variantId) {
        setSessionSoldDelta((prev) => ({ ...prev, [variantId]: (prev[variantId] ?? 0) + soldQty }));
      }
      setActive(null);
      setAddCustomer(false);
      setSelectedCustomer(null);
      if (offline) {
        useToastStore.getState().show(t("hawker.savedOffline"), "success");
      } else {
        queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-products"] });
        queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-today-sold"] });
      }
    },
    onError: (err) => useToastStore.getState().show(extractErrorMessage(err, t("hawker.saveFailed")), "error"),
  });

  // Caps the qty stepper against what's actually left after this session's own (possibly still
  // offline-queued) sales, not just the last-synced stock figure.
  const activeRemainingStock = active
    ? Math.max(0, active.stock - (sessionSoldDelta[active.variantId] ?? 0))
    : 0;

  return (
    <>
      <div className="px-4 py-4 space-y-4">
        {/* Date + running total */}
        <div className="bg-indigo-50 rounded-xl px-4 py-3 divide-y divide-indigo-100">
          <div className="flex items-center justify-between pb-3">
            <div>
              <label className="text-xs text-indigo-500 font-medium block mb-1">{t("hawker.entryDate")}</label>
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-sm"
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-indigo-500">{t("hawker.entriesSoFar")}</p>
              <p className="text-lg font-bold text-indigo-700">
                {sessionCount} · ৳{sessionTotal.toLocaleString()}
              </p>
            </div>
          </div>

          {canSeeCosts() && (
            <div className="flex items-center justify-between pt-3">
              <p className="text-xs text-emerald-600 font-medium">{t("hawker.todaysProfit")}</p>
              <p className="text-lg font-bold text-emerald-700">৳{sessionProfit.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Product tile grid */}
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("common.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("hawker.noProducts")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => {
              const hasDiscount = p.marketPrice != null && p.marketPrice > p.sellingPrice;
              const discountPct = hasDiscount
                ? Math.round(((p.marketPrice! - p.sellingPrice) / p.marketPrice!) * 100)
                : 0;
              const displayName = stripDiscountSuffix(p.productName);
              const soldToday = (todaySold[p.variantId] ?? 0) + (sessionSoldDelta[p.variantId] ?? 0);

              return (
                <button
                  key={p.variantId}
                  onClick={() => openTile(p)}
                  className="flex flex-col gap-1.5 p-2 rounded-2xl border border-gray-100 bg-white active:bg-indigo-50 active:scale-95 transition-all text-left"
                >
                  <div className="w-full aspect-square rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(p.imageUrl) ?? ''} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">📦</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 text-center leading-tight line-clamp-2">
                    {displayName}
                  </span>
                  <div className="text-xs space-y-0.5">
                    {hasDiscount && (
                      <>
                        <div className="flex items-center justify-between text-gray-400">
                          <span>{t("hawker.marketPrice")}</span>
                          <span className="line-through">৳{p.marketPrice!.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-green-600 font-medium">
                          <span>{t("hawker.discount")}</span>
                          <span>-{discountPct}%</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{t("hawker.currentPrice")}</span>
                      <span className="text-base font-bold text-indigo-700">৳{p.sellingPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>{t("hawker.todaySale")}</span>
                      <span className="font-medium text-gray-600">{soldToday} {p.unitCode || "pcs"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Price entry sheet */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[768px] bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{stripDiscountSuffix(active.productName)}</p>
              <button onClick={() => setActive(null)} className="text-gray-400">
                ✕
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-400 text-center mb-1">
                {t("hawker.currentPrice")}: ৳{active.sellingPrice.toLocaleString()}
              </p>
              <label className="text-xs text-gray-500 font-medium block mb-1">{t("hawker.soldPrice")}</label>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full text-3xl font-bold text-center border border-gray-200 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {price !== "" && !isNaN(parseFloat(price)) && parseFloat(price) !== active.sellingPrice && (
                parseFloat(price) < active.sellingPrice ? (
                  <p className="text-xs text-red-600 mt-1.5">
                    {t("hawker.priceLessThanCurrent", { amount: (active.sellingPrice - parseFloat(price)).toLocaleString() })}
                  </p>
                ) : (
                  <p className="text-xs text-green-600 mt-1.5">
                    {t("hawker.priceGreaterThanCurrent", { amount: (parseFloat(price) - active.sellingPrice).toLocaleString() })}
                  </p>
                )
              )}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 text-lg"
              >
                −
              </button>
              <span className="text-lg font-semibold w-8 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(activeRemainingStock, q + 1))}
                className="w-10 h-10 rounded-full bg-indigo-100 text-lg"
              >
                +
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium">{t("hawker.addCustomerInfo")}</label>
              <button
                type="button"
                role="switch"
                aria-checked={addCustomer}
                onClick={() => {
                  setAddCustomer((v) => !v);
                  if (addCustomer) setSelectedCustomer(null);
                }}
                className={`relative w-10 h-6 rounded-full transition-colors ${addCustomer ? "bg-indigo-600" : "bg-gray-200"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${addCustomer ? "translate-x-4" : ""}`}
                />
              </button>
            </div>

            {addCustomer && (
              <CustomerSummaryRow
                customerName={selectedCustomer?.name ?? ""}
                customerPhone={selectedCustomer?.phone ?? ""}
                addLabel={t("hawker.selectCustomer")}
                onAdd={() => setCustomerPickerOpen(true)}
                onClear={() => setSelectedCustomer(null)}
              />
            )}

            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">{t("hawker.note")}</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("hawker.notePlaceholder")}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !price || parseFloat(price) <= 0}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-base disabled:opacity-40"
            >
              {save.isPending
                ? t("hawker.saving")
                : `${t("hawker.confirmSale")} · ৳${((parseFloat(price) || 0) * qty).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      <CustomerPickerSlide
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => setSelectedCustomer(c)}
        selectedPhone={selectedCustomer?.phone || undefined}
      />
    </>
  );
}
