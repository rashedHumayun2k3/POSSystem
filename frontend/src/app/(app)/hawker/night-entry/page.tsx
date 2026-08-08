"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrder, addOrderPayment } from "@/lib/ordersApi";
import { enqueueOfflineSale, isNetworkError, useOfflineSyncEngine, usePendingSalesCount, usePendingSaleItems } from "@/lib/posSync";
import {
  browseProductsWithFallback,
  searchProductsWithFallback,
  getActiveCategoriesWithFallback,
  getTodaySoldWithFallback,
  getTodayHawkerProfitWithFallback,
  useCatalogAutoSync,
} from "@/lib/localDb/catalogCache";
import { resolveMediaUrl } from "@/lib/media";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { usePressAndHold } from "@/hooks/usePressAndHold";
import type { ProductSearchResult } from "@/types/catalog";
import CustomerPickerSlide, { type SelectedCustomer } from "@/components/orders/CustomerPickerSlide";
import CustomerSummaryRow from "@/components/orders/CustomerSummaryRow";
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

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

const PRICE_STEP = 10;

export default function NightEntryPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const canSeeCosts = useAuthStore((s) => s.canSeeCosts);
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  useCatalogAutoSync();
  // Night Entry is the entire "New Sale" flow for hawker businesses — they never visit /pos, so
  // this can't rely on that page to be the one that starts the queued-sale sync loop. Without this
  // call here, sales queued offline while on this screen would never sync back at all.
  useOfflineSyncEngine();
  const pendingSalesCount = usePendingSalesCount();
  // Line items across every sale still sitting in the offline queue (not yet synced to the
  // server) — read live from the persisted queue (SQLite/Dexie), not a React-state tally. That's
  // the fix for the reload bug: a plain in-memory counter forgets everything the instant the page
  // remounts, even though the queued sales themselves are still safely on disk.
  const pendingItems = usePendingSaleItems();

  const [active, setActive] = useState<ProductSearchResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [addCustomer, setAddCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Closes the brief gap between "a queued sale just synced" and "the server aggregate reflects
  // it": the sale disappears from pendingItems immediately once synced, but todaySold/profit are
  // cached for 15s (staleTime) so they wouldn't otherwise pick up the change until that expires —
  // without this, the tile could briefly under-count right after a sync finishes. Only refetches
  // (no longer resets any session state — there isn't any left to reset).
  const prevPendingRef = useRef(pendingSalesCount);
  useEffect(() => {
    if (prevPendingRef.current > 0 && pendingSalesCount === 0) {
      queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-products"] });
      queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-search"] });
      queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-today-sold"] });
      queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-today-profit"] });
    }
    prevPendingRef.current = pendingSalesCount;
  }, [pendingSalesCount, queryClient]);

  const { data: categories = [] } = useQuery({
    queryKey: ["hawker-night-entry-categories"],
    queryFn: getActiveCategoriesWithFallback,
  });

  const isSearching = searchMode && debouncedSearch.trim().length > 0;

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: isSearching
      ? ["hawker-night-entry-search", debouncedSearch, currentBranchId]
      : ["hawker-night-entry-products", selectedCategoryId, currentBranchId],
    queryFn: () =>
      isSearching
        ? searchProductsWithFallback(debouncedSearch, true)
        : browseProductsWithFallback(selectedCategoryId ?? undefined, true),
  });

  // Night Entry is built around the market-price/discount workflow ("Sell Price" set on the
  // product, struck through against the negotiated price) — a product with no Sell Price has
  // nothing for that workflow to show, so it's left out of this grid entirely rather than
  // appearing with a blank discount area.
  const products = allProducts.filter((p) => p.marketPrice != null);

  const { data: todaySold = {} } = useQuery({
    queryKey: ["hawker-night-entry-today-sold", currentBranchId],
    queryFn: getTodaySoldWithFallback,
    staleTime: 15_000,
  });

  const { data: todayServerProfit = 0 } = useQuery({
    queryKey: ["hawker-night-entry-today-profit", currentBranchId],
    queryFn: getTodayHawkerProfitWithFallback,
    enabled: canSeeCosts(),
    staleTime: 15_000,
  });

  // Per-variant qty/revenue still queued (not yet synced) — merged on top of the server's
  // todaySold so the tile reflects a just-made sale immediately, synced or not, and survives a
  // reload since it's recomputed from the persisted queue every time this hook re-reads it.
  const pendingByVariant = useMemo(() => {
    const agg: Record<string, { qty: number; amount: number }> = {};
    for (const item of pendingItems) {
      const entry = agg[item.variantId] ?? { qty: 0, amount: 0 };
      entry.qty += item.qty;
      entry.amount += item.qty * item.unitPrice;
      agg[item.variantId] = entry;
    }
    return agg;
  }, [pendingItems]);

  // Profit for queued-but-unsynced sales, approximated with each item's *current* avgLandedCost
  // (the queue only stores variantId/qty/unitPrice, not a cost snapshot) — looked up against
  // whatever's currently loaded in allProducts, so a pending item for a variant outside the
  // presently selected category/search won't resolve until that filter changes; it self-corrects
  // the moment the sale actually syncs and the server total takes over anyway.
  const pendingProfit = useMemo(() => {
    if (!canSeeCosts()) return 0;
    return pendingItems.reduce((sum, item) => {
      const cost = allProducts.find((p) => p.variantId === item.variantId)?.avgLandedCost ?? 0;
      return sum + (item.unitPrice - cost) * item.qty;
    }, 0);
  }, [pendingItems, allProducts, canSeeCosts]);

  const todayHawkerProfit = todayServerProfit + pendingProfit;

  const openTile = (p: ProductSearchResult) => {
    setActive(p);
    setConfirmOpen(false);
    setPrice(String(p.sellingPrice));
    setQty(1);
    setNote("");
    setAddCustomer(false);
    setSelectedCustomer(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!active) return { offline: false };
      const unitPrice = parseFloat(price) || 0;
      const total = unitPrice * qty;
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
          businessDate: todayStr(),
        });
        await addOrderPayment(order.id, { method: "CASH", amount: total });
        return { offline: false };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // No network — queue the sale locally instead of blocking the seller. saleId doubles as
        // the eventual order's Idempotency-Key/ClientUid, same pattern the regular POS offline
        // queue uses (see lib/posSync.ts). The tile/profit numbers pick this up immediately via
        // pendingItems (usePendingSaleItems reacts to the queue live) — no manual state update
        // needed here.
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
          businessDate: todayStr(),
          createdAt: Date.now(),
        });
        return { offline: true };
      }
    },
    onSuccess: ({ offline }) => {
      setActive(null);
      setAddCustomer(false);
      setSelectedCustomer(null);
      if (offline) {
        useToastStore.getState().show(t("hawker.savedOffline"), "success");
      } else {
        queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-products"] });
        queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-search"] });
        queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-today-sold"] });
        queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-today-profit"] });
      }
    },
    onError: (err) => useToastStore.getState().show(extractErrorMessage(err, t("hawker.saveFailed")), "error"),
  });

  // Caps the qty stepper against what's actually left after this session's own (possibly still
  // offline-queued) sales, not just the last-synced stock figure.
  const activeRemainingStock = active
    ? Math.max(0, active.stock - (pendingByVariant[active.variantId]?.qty ?? 0))
    : 0;
  const activeHasDiscount = !!active && active.marketPrice != null && active.marketPrice > active.sellingPrice;
  const activeDiscountPct = activeHasDiscount
    ? Math.round(((active!.marketPrice! - active!.sellingPrice) / active!.marketPrice!) * 100)
    : 0;
  const activeSoldToday = active
    ? (todaySold[active.variantId]?.qty ?? 0) + (pendingByVariant[active.variantId]?.qty ?? 0)
    : 0;
  const activeSoldTodayAmount = active
    ? (todaySold[active.variantId]?.amount ?? 0) + (pendingByVariant[active.variantId]?.amount ?? 0)
    : 0;

  const decreasePrice = useCallback(() => {
    setPrice((p) => String(Math.max(0, (parseFloat(p) || 0) - PRICE_STEP)));
  }, []);
  const increasePrice = useCallback(() => {
    setPrice((p) => String((parseFloat(p) || 0) + PRICE_STEP));
  }, []);
  const priceDecreaseHold = usePressAndHold(decreasePrice);
  const priceIncreaseHold = usePressAndHold(increasePrice);

  return (
    <>
      <div className="px-4 py-4 space-y-2">
        {canSeeCosts() && (
          <p className="text-xs text-emerald-600 font-medium">
            {t("hawker.todaysProfit")}: ৳{todayHawkerProfit.toLocaleString()}
          </p>
        )}

        {/* Category filter + search toggle — search replaces this row entirely while active,
            rather than sitting alongside it, since there's only room for one on a phone screen.
            The category selector is a custom dropdown rather than a native <select> — a native
            select's popup width is rendered by the browser/OS itself (not this component's CSS),
            and was overflowing past the screen edge on longer category names. */}
        <div className="flex items-center gap-2">
          {!searchMode ? (
            <>
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-left"
                >
                  <span className="truncate">
                    {selectedCategoryId ? categories.find((c) => c.id === selectedCategoryId)?.name : t("hawker.allCategories")}
                  </span>
                  <ChevronDownIcon className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {categoryDropdownOpen && (
                  <>
                    {/* Full-screen transparent backdrop — closes the dropdown on outside tap */}
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen(false)}
                      className="fixed inset-0 z-40"
                      aria-label="Close"
                    />
                    <div className="absolute z-50 top-full left-0 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                      <button
                        type="button"
                        onClick={() => { setSelectedCategoryId(null); setCategoryDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 text-sm truncate ${selectedCategoryId === null ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700 active:bg-gray-50"}`}
                      >
                        {t("hawker.allCategories")}
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCategoryId(c.id); setCategoryDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm truncate ${selectedCategoryId === c.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700 active:bg-gray-50"}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setSearchMode(true)}
                className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200"
              >
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-500" />
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("hawker.searchPlaceholder")}
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
              <button
                onClick={() => { setSearchMode(false); setSearch(""); }}
                className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </>
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
              const soldToday = (todaySold[p.variantId]?.qty ?? 0) + (pendingByVariant[p.variantId]?.qty ?? 0);
              const soldTodayAmount = (todaySold[p.variantId]?.amount ?? 0) + (pendingByVariant[p.variantId]?.amount ?? 0);

              return (
                <button
                  key={p.variantId}
                  onClick={() => openTile(p)}
                  className="flex flex-col gap-1.5 p-2 rounded-2xl border border-gray-100 bg-white active:bg-indigo-50 active:scale-95 transition-all text-left"
                >
                  <div className="relative w-full aspect-square rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(p.imageUrl) ?? ''} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">📦</span>
                    )}
                    {hasDiscount && (
                      <span className="absolute top-1 right-1 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        -{discountPct}%
                      </span>
                    )}
                    <span className="absolute bottom-1 right-1 bg-indigo-700 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                      ৳{p.sellingPrice.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 text-center leading-tight line-clamp-2">
                    {displayName}
                  </span>
                  <div className="flex items-center justify-between text-xs bg-orange-700 text-white rounded-lg px-2 py-1">
                    <span className="text-orange-100">{t("hawker.todaySale")}</span>
                    <span className="font-semibold">৳{soldTodayAmount.toLocaleString()} ({soldToday} {p.unitCode || "pcs"})</span>
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

            <p className="text-xs text-orange-700 font-medium text-center">
              {t("hawker.alreadySoldToday")} ৳{activeSoldTodayAmount.toLocaleString()} ({activeSoldToday} {active.unitCode || "pcs"})
              <br />
              {t("hawker.currentPrice")}: ৳{active.sellingPrice.toLocaleString()}
              {activeHasDiscount && (
                <>
                  {" "}
                  <span className="line-through">৳{active.marketPrice!.toLocaleString()}</span>
                  {" "}
                  <span className="text-green-600 font-semibold">{t("hawker.discount")} -{activeDiscountPct}%</span>
                </>
              )}
            </p>

            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">{t("hawker.soldPrice")}</label>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  {...priceDecreaseHold}
                  className="shrink-0 w-16 h-16 rounded-full bg-orange-700 text-3xl font-semibold text-white active:bg-orange-800 select-none"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 min-w-0 text-2xl font-bold text-center border border-gray-200 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  {...priceIncreaseHold}
                  className="shrink-0 w-16 h-16 rounded-full bg-orange-700 text-3xl font-semibold text-white active:bg-orange-800 select-none"
                >
                  +
                </button>
              </div>
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

            <div className="bg-gray-100 rounded-2xl px-3 py-2 flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium">{t("hawker.quantity")}</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full bg-white text-lg"
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
              onClick={() => setConfirmOpen(true)}
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

      {/* Sale summary — a deliberate second tap before the sale actually commits, stacked above
          the price sheet rather than replacing it, so Return just dismisses this and leaves
          everything already entered untouched. */}
      {confirmOpen && active && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50">
          <div className="w-full max-w-[768px] bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4">
            <p className="text-sm font-semibold text-gray-900">{t("hawker.confirmSummaryTitle")}</p>

            <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-400">{t("hawker.productLabel")}</span>
                <span className="text-sm font-medium text-gray-900 text-right">{stripDiscountSuffix(active.productName)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-400">{t("hawker.quantity")}</span>
                <span className="text-sm font-medium text-gray-900">{qty} {active.unitCode || "pcs"}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-400">{t("hawker.soldPrice")}</span>
                <span className="text-sm font-medium text-gray-900">৳{(parseFloat(price) || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-orange-700 rounded-b-2xl">
                <span className="text-xs text-orange-100 font-semibold">{t("hawker.total")}</span>
                <span className="text-lg font-bold text-white">৳{((parseFloat(price) || 0) * qty).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm"
              >
                {t("hawker.returnButton")}
              </button>
              <button
                onClick={() => { setConfirmOpen(false); save.mutate(); }}
                disabled={save.isPending}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40"
              >
                {t("hawker.confirmOk")}
              </button>
            </div>
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
