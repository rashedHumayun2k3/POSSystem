"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { browseProducts } from "@/lib/catalogApi";
import { createOrder, confirmOrder, addOrderPayment } from "@/lib/ordersApi";
import { resolveMediaUrl } from "@/lib/media";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToastStore } from "@/store/toastStore";
import type { ProductSearchResult } from "@/types/catalog";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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

  const [date, setDate] = useState(todayStr());
  const [active, setActive] = useState<ProductSearchResult | null>(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["hawker-night-entry-products"],
    queryFn: () => browseProducts(undefined, true),
  });

  const openTile = (p: ProductSearchResult) => {
    setActive(p);
    setPrice(String(p.sellingPrice));
    setQty(1);
    setNote("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!active) return 0;
      const unitPrice = parseFloat(price) || 0;
      const order = await createOrder({
        channel: "HAWKER",
        customerPhone: "00000000000",
        customerName: "Walk-in",
        isDraft: false,
        items: [{ variantId: active.variantId, qty, unitPrice }],
        deliveryChargeCustomer: 0,
        advancePaid: 0,
        note: note.trim() || undefined,
        clientUid: crypto.randomUUID(),
        businessDate: date,
      });
      await confirmOrder(order.id);
      const total = unitPrice * qty;
      await addOrderPayment(order.id, { method: "CASH", amount: total });
      return total;
    },
    onSuccess: (total) => {
      setSessionCount((c) => c + 1);
      setSessionTotal((sum) => sum + total);
      setActive(null);
      queryClient.invalidateQueries({ queryKey: ["hawker-night-entry-products"] });
    },
    onError: (err) => useToastStore.getState().show(extractErrorMessage(err, t("hawker.saveFailed")), "error"),
  });

  return (
    <>
      <div className="px-4 py-4 space-y-4">
        {/* Date + running total */}
        <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
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

        {/* Product tile grid */}
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("common.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("hawker.noProducts")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <button
                key={p.variantId}
                onClick={() => openTile(p)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl border border-gray-100 bg-white active:bg-indigo-50 active:scale-95 transition-all"
              >
                <div className="w-full aspect-square rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(p.imageUrl) ?? ''} alt={p.productName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl">📦</span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 text-center leading-tight line-clamp-2">
                  {p.productName}
                </span>
                <span className="text-base font-bold text-indigo-700">৳{p.sellingPrice}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price entry sheet */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[768px] bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{active.productName}</p>
              <button onClick={() => setActive(null)} className="text-gray-400">
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">{t("hawker.soldPrice")}</label>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full text-3xl font-bold text-center border border-gray-200 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
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
                onClick={() => setQty((q) => Math.min(active.stock, q + 1))}
                className="w-10 h-10 rounded-full bg-indigo-100 text-lg"
              >
                +
              </button>
            </div>

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
    </>
  );
}
