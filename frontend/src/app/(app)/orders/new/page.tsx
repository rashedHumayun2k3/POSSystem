"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AppHeader from "@/components/layout/AppHeader";
import { XMarkIcon, PlusIcon, MinusIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";

// ── Types ──────────────────────────────────────────────────────────────────
interface CartLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  qty: number;
  available: number;
}

interface CustomerInfo {
  phone: string;
  name: string;
  address: string;
}

const CHANNELS = ["FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE", "SHOP", "OTHER"] as const;
type Channel = (typeof CHANNELS)[number];

// ── Main component ─────────────────────────────────────────────────────────
export default function NewOrderPage() {
  const router = useRouter();
  const isOwner = useAuthStore((s) => s.isOwner());
  const { t } = useLanguage();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>({ phone: "", name: "", address: "" });
  const [channel, setChannel] = useState<Channel>("FACEBOOK");
  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "FIXED">("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showDiscountSheet, setShowDiscountSheet] = useState(false);
  const [error, setError] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["product-search", productSearch],
    queryFn: () =>
      productSearch.length >= 2
        ? api.get(`/products/search?q=${encodeURIComponent(productSearch)}&includeVariants=true`).then((r) => r.data)
        : Promise.resolve([]),
    enabled: productSearch.length >= 2,
  });

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const discountAmount = (() => {
    const v = parseFloat(discountValue) || 0;
    if (discountType === "PERCENT") return subtotal * (v / 100);
    if (discountType === "FIXED") return v;
    return 0;
  })();

  const deliveryNum = parseFloat(deliveryCharge) || 0;
  const total = subtotal - discountAmount + deliveryNum;

  const addToCart = (variant: {
    id: string; productName: string; variantLabel: string;
    sellingPrice: number; available: number;
  }) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variant.id && l.qty < l.available
            ? { ...l, qty: l.qty + 1 }
            : l
        );
      }
      if (variant.available <= 0) {
        setError(t("orders.outOfStockError", { product: variant.productName }));
        return prev;
      }
      return [...prev, {
        variantId: variant.id,
        productName: variant.productName,
        variantLabel: variant.variantLabel,
        unitPrice: variant.sellingPrice,
        qty: 1,
        available: variant.available,
      }];
    });
    setProductSearch("");
    setError("");
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => l.variantId === variantId ? { ...l, qty: Math.max(0, Math.min(l.available, l.qty + delta)) } : l)
        .filter((l) => l.qty > 0)
    );
  };

  const updatePrice = (variantId: string, price: string) => {
    setCart((prev) =>
      prev.map((l) => l.variantId === variantId ? { ...l, unitPrice: parseFloat(price) || 0 } : l)
    );
  };

  const createOrder = useMutation({
    mutationFn: (isDraft: boolean) =>
      api.post("/orders", {
        channel,
        customerPhone: customer.phone,
        customerName: customer.name,
        customerAddress: customer.address,
        isDraft,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        deliveryChargeCustomer: deliveryNum,
        deliveryChargeActual: deliveryNum,
        advancePaid: parseFloat(advancePaid) || 0,
        note,
        items: cart.map((l) => ({
          variantId: l.variantId,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      }),
    onSuccess: (res) => {
      router.push(`/orders/${res.data.id}`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? t("orders.failedCreate"));
    },
  });

  const safeDiscountLimit = isOwner ? (subtotal > 0 ? subtotal - subtotal * 0.1 : 0) : null;

  const discountSummary = discountType === "PERCENT" ? `${discountValue}%` : `৳${discountValue}`;

  return (
    <>
      <AppHeader title={t("orders.newTitle")} backHref="/orders" />

      <div className="px-4 pb-32 space-y-5 pt-4">
        {/* ── Product search ─────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t("orders.productsSection")}</p>
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              inputMode="text"
              placeholder={t("orders.searchPlaceholder")}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                {searchResults.map((v: {
                  id: string; productName: string; variantLabel: string;
                  sellingPrice: number; available: number;
                }) => (
                  <button
                    key={v.id}
                    onClick={() => addToCart(v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{v.productName}</p>
                      {v.variantLabel && <p className="text-xs text-gray-400">{v.variantLabel}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">৳{v.sellingPrice}</p>
                      <p className={`text-xs ${v.available <= 0 ? "text-red-500" : "text-gray-400"}`}>
                        {v.available <= 0 ? t("orders.outOfStock") : t("orders.stockLeft", { n: v.available })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {productSearch.length >= 2 && searchResults.length === 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-400">
                {t("orders.noProductsFound")}
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="mt-3 text-center text-sm text-gray-400 py-6 border-2 border-dashed border-gray-200 rounded-xl">
              {t("orders.emptyCart")}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {cart.map((line) => (
                <div key={line.variantId} className="bg-white rounded-xl border border-gray-100 px-3 py-3 flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{line.productName}</p>
                    {line.variantLabel && <p className="text-xs text-gray-400">{line.variantLabel}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-400">{t("orders.priceLabel")}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) => updatePrice(line.variantId, e.target.value)}
                        className="w-20 h-7 border border-gray-200 rounded-lg text-sm px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(line.variantId, -1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <MinusIcon className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{line.qty}</span>
                    <button onClick={() => updateQty(line.variantId, 1)}
                      disabled={line.qty >= line.available}
                      className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center disabled:opacity-40">
                      <PlusIcon className="w-4 h-4 text-indigo-600" />
                    </button>
                    <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                      ৳{(line.unitPrice * line.qty).toFixed(0)}
                    </span>
                    <button onClick={() => setCart((p) => p.filter((l) => l.variantId !== line.variantId))}
                      className="ml-1 text-gray-300 hover:text-red-500">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Customer ───────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t("orders.customerSection")}</p>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <input
              type="tel" inputMode="tel" placeholder={t("orders.phonePlaceholder")}
              value={customer.phone}
              onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text" placeholder={t("orders.customerNamePlaceholder")}
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              placeholder={t("orders.addressPlaceholder")}
              rows={2}
              value={customer.address}
              onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button key={ch} onClick={() => setChannel(ch)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    channel === ch ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Money ─────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t("orders.paymentSection")}</p>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{t("orders.subtotal")}</span>
              <span className="font-medium text-gray-900">৳{subtotal.toFixed(2)}</span>
            </div>

            <div>
              <button onClick={() => setShowDiscountSheet(true)}
                className="text-sm text-indigo-600 font-medium">
                {discountType === "NONE"
                  ? t("orders.addDiscount")
                  : t("orders.discountActive", { summary: discountSummary, amount: discountAmount.toFixed(2) })}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 flex-1">{t("orders.deliveryCharge")}</label>
              <input type="number" inputMode="decimal" value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                className="w-24 h-9 border border-gray-200 rounded-lg text-sm px-2 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 flex-1">{t("orders.advancePaid")}</label>
              <input type="number" inputMode="decimal" value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-24 h-9 border border-gray-200 rounded-lg text-sm px-2 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>

            <div className="flex justify-between text-base font-bold border-t pt-3">
              <span>{t("orders.totalCod")}</span>
              <span className="text-indigo-700">৳{total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* ── Note ──────────────────────────────────────────── */}
        <section>
          <textarea placeholder={t("orders.notePlaceholder")} rows={2} value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white" />
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ── Sticky bottom actions ──────────────────────────── */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button
          onClick={() => createOrder.mutate(true)}
          disabled={createOrder.isPending || cart.length === 0}
          className="flex-1 h-12 rounded-xl border-2 border-indigo-600 text-indigo-600 font-semibold text-sm disabled:opacity-40"
        >
          {t("orders.saveDraft")}
        </button>
        <button
          onClick={() => createOrder.mutate(false)}
          disabled={createOrder.isPending || cart.length === 0 || !customer.name}
          className="flex-2 flex-grow-[2] h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
        >
          {createOrder.isPending ? t("common.saving") : t("orders.confirmOrder")}
        </button>
      </div>

      {/* ── Discount bottom sheet ──────────────────────────── */}
      {showDiscountSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDiscountSheet(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <p className="text-base font-semibold text-gray-900">{t("orders.discountLabel")}</p>

            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(["NONE", "PERCENT", "FIXED"] as const).map((dtype) => (
                <button key={dtype} onClick={() => setDiscountType(dtype)}
                  className={`flex-1 py-2 text-sm font-medium transition ${discountType === dtype ? "bg-indigo-600 text-white" : "text-gray-600"}`}>
                  {dtype === "NONE" ? t("orders.discountNone") : dtype === "PERCENT" ? t("orders.discountPercent") : t("orders.discountFixed")}
                </button>
              ))}
            </div>

            {discountType !== "NONE" && (
              <div>
                <input type="number" inputMode="decimal"
                  placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 50"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full h-12 border border-gray-200 rounded-xl px-4 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isOwner && safeDiscountLimit !== null && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t("orders.safeLimit", { limit: safeDiscountLimit.toFixed(0) })}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  {t("orders.discountAmount")} <span className="font-semibold text-red-600">−৳{discountAmount.toFixed(2)}</span>
                </p>
              </div>
            )}

            <button onClick={() => setShowDiscountSheet(false)}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm">
              {t("orders.apply")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
