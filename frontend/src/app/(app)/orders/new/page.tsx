"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createOrder as createOrderApi, listCouriers } from "@/lib/ordersApi";
import { useAuthStore } from "@/store/authStore";
import AppHeader from "@/components/layout/AppHeader";
import { XMarkIcon, PlusIcon, MinusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";
import CustomerPickerSlide, { type SelectedCustomer } from "@/components/orders/CustomerPickerSlide";
import ProductPicker from "@/components/purchases/ProductPicker";
import type { ProductSearchResult } from "@/types/catalog";

// ── Types ──────────────────────────────────────────────────────────────────
interface CartLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  qty: number;
  available: number;
}

const CHANNELS = ["FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE", "SHOP", "OTHER"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  FACEBOOK: "📘 Facebook",
  WHATSAPP: "💬 WhatsApp",
  INSTAGRAM: "📷 Instagram",
  PHONE: "📞 Phone",
  SHOP: "🏪 Shop",
  OTHER: "Other",
};

const CHANNEL_ACTIVE_CLS: Record<Channel, string> = {
  FACEBOOK:  "bg-blue-600   text-white border-blue-600",
  WHATSAPP:  "bg-green-500  text-white border-green-500",
  INSTAGRAM: "bg-pink-600   text-white border-pink-600",
  PHONE:     "bg-slate-600  text-white border-slate-600",
  SHOP:      "bg-amber-500  text-white border-amber-500",
  OTHER:     "bg-gray-500   text-white border-gray-500",
};

// ── Main component ─────────────────────────────────────────────────────────
export default function NewOrderPage() {
  const router = useRouter();
  const isOwner = useAuthStore((s) => s.isOwner());
  const { t } = useLanguage();

  // ── Cart state ──────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // ── Customer state ──────────────────────────────────────────────────────
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  // ── Order details ───────────────────────────────────────────────────────
  const [channel, setChannel] = useState<Channel>("FACEBOOK");
  const [courierId, setCourierId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "FIXED">("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [advanceMethod, setAdvanceMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [showDiscountSheet, setShowDiscountSheet] = useState(false);
  const [error, setError] = useState("");

  // ── Couriers ────────────────────────────────────────────────────────────
  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers"],
    queryFn: listCouriers,
    staleTime: 60_000,
  });
  const selectedCourier = couriers.find((c) => c.id === courierId) ?? null;

  // ── Money calculations ──────────────────────────────────────────────────
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const discountAmount = (() => {
    const v = parseFloat(discountValue) || 0;
    if (discountType === "PERCENT") return subtotal * (v / 100);
    if (discountType === "FIXED") return v;
    return 0;
  })();

  const deliveryNum = parseFloat(deliveryCharge) || 0;
  const total = subtotal - discountAmount + deliveryNum;
  const safeDiscountLimit = isOwner ? (subtotal > 0 ? subtotal - subtotal * 0.1 : 0) : null;

  // ── Cart operations ─────────────────────────────────────────────────────
  const addToCart = (result: ProductSearchResult) => {
    let variantLabel = "";
    try {
      const vals = JSON.parse(result.variantValuesJson) as Record<string, string>;
      const pairs = Object.values(vals);
      if (pairs.length > 0) variantLabel = pairs.join(" / ");
    } catch { /* ignore */ }

    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === result.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === result.variantId && l.qty < l.available ? { ...l, qty: l.qty + 1 } : l
        );
      }
      if (result.stock <= 0) {
        setError(t("orders.outOfStockError", { product: result.productName }));
        return prev;
      }
      return [...prev, {
        variantId: result.variantId,
        productName: result.productName,
        variantLabel,
        unitPrice: result.sellingPrice,
        qty: 1,
        available: result.stock,
      }];
    });
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

  // ── Submit ──────────────────────────────────────────────────────────────
  const createOrder = useMutation({
    mutationFn: (isDraft: boolean) =>
      createOrderApi({
        channel,
        customerPhone: customer?.phone || "00000000000",
        customerName: customer?.name || "Walk-in",
        customerAddress: deliveryAddress.trim() || customer?.address || undefined,
        isDraft,
        courierId: courierId || undefined,
        advancePaymentMethod: parseFloat(advancePaid) > 0 ? advanceMethod : undefined,
        discountType: discountType === "NONE" ? undefined : discountType,
        discountValue: discountType !== "NONE" ? (parseFloat(discountValue) || 0) : undefined,
        deliveryChargeCustomer: deliveryNum,
        advancePaid: parseFloat(advancePaid) || 0,
        note: note.trim() || undefined,
        clientUid: crypto.randomUUID(),
        items: cart.map((l) => ({
          variantId: l.variantId,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      }),
    onSuccess: (order) => router.push(`/orders/${order.id}`),
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { unavailableItems?: string[]; message?: string } } })?.response?.data;
      if (data?.unavailableItems?.length) {
        setError(`${t("orders.stockUnavailable")}: ${data.unavailableItems.join(", ")}`);
      } else {
        setError(data?.message ?? t("orders.failedCreate"));
      }
    },
  });

  const canConfirm = cart.length > 0;
  const canDraft = cart.length > 0;

  return (
    <>
      <AppHeader title={t("orders.newTitle")} backHref="/orders" />

      <div className="px-4 pb-32 space-y-5 pt-4">

        {/* ── 1. Products ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("orders.productsSection")}
            </p>
            <button
              onClick={() => setProductPickerOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl active:bg-indigo-100"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              {t("orders.addItem")}
            </button>
          </div>

          {cart.length === 0 ? (
            <button
              onClick={() => setProductPickerOpen(true)}
              className="w-full mt-1 py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 active:border-indigo-300 active:text-indigo-400 transition-colors"
            >
              {t("orders.emptyCart")}
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              {cart.map((line) => (
                <div key={line.variantId} className="bg-indigo-50 rounded-xl border border-indigo-100 px-3 py-3 flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-indigo-800 truncate">{line.productName}</p>
                    {line.variantLabel && <p className="text-xs text-indigo-400">{line.variantLabel}</p>}
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
                  <div className="flex flex-col items-end gap-1">
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
                      <span className="text-sm font-semibold text-indigo-700 w-16 text-right">
                        ৳{(line.unitPrice * line.qty).toFixed(0)}
                      </span>
                      <button onClick={() => setCart((p) => p.filter((l) => l.variantId !== line.variantId))}
                        className="ml-1 text-gray-300 hover:text-red-500">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <span className={`text-[10px] font-medium ${
                      line.available - line.qty <= 2 ? "text-red-500" : "text-gray-400"
                    }`}>
                      {line.available - line.qty} left in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 2. Customer ──────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t("orders.customerSection")}
          </p>

          {customer ? (
            /* Selected customer card */
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">{customer.name}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">{customer.phone}</p>
                  {customer.address && (
                    <p className="text-xs text-emerald-600 mt-0.5 truncate">📍 {customer.address}</p>
                  )}
                  {customer.isNew && (
                    <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {t("orders.newCustomerBadge")}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setCustomerPickerOpen(true)}
                  className="text-xs text-emerald-700 font-semibold shrink-0 pt-0.5"
                >
                  {t("orders.changeCustomer")}
                </button>
              </div>
              {/* Delivery address — editable per order */}
              <div className="mt-3 pt-3 border-t border-emerald-100">
                <label className="text-xs text-emerald-600 font-medium mb-1 block">
                  {t("orders.deliveryAddressLabel")}
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={customer?.address || t("orders.addressPlaceholder")}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
            </div>
          ) : (
            /* Empty state — tap to select */
            <button
              onClick={() => setCustomerPickerOpen(true)}
              className="w-full bg-white rounded-xl border border-dashed border-gray-300 px-4 py-4 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{t("orders.tapToSelectCustomer")}</p>
                <p className="text-xs text-gray-400">{t("orders.searchByPhoneOrName")}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-300" />
            </button>
          )}
        </section>

        {/* ── 3. Channel ───────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t("orders.channelSection")}
          </p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => {
                  setChannel(ch);
                  if (ch === "SHOP") { setCourierId(""); setDeliveryCharge("0"); }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  channel === ch
                    ? CHANNEL_ACTIVE_CLS[ch]
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>
        </section>

        {/* ── 4. Courier service ───────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t("orders.courierSection")}
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => { setCourierId(""); setDeliveryCharge("0"); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                courierId === "" ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-500 border-gray-200"
              }`}
            >
              {t("orders.noCourier")}
            </button>
            {couriers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCourierId(c.id);
                  setDeliveryCharge(String(c.outsideDhakaCharge));
                }}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                  courierId === c.id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {selectedCourier && (
            <div className="flex gap-2">
              <button
                onClick={() => setDeliveryCharge(String(selectedCourier.insideDhakaCharge))}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                  deliveryCharge === String(selectedCourier.insideDhakaCharge)
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {t("orders.insideDhaka")} · ৳{selectedCourier.insideDhakaCharge}
              </button>
              <button
                onClick={() => setDeliveryCharge(String(selectedCourier.outsideDhakaCharge))}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                  deliveryCharge === String(selectedCourier.outsideDhakaCharge)
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {t("orders.outsideDhaka")} · ৳{selectedCourier.outsideDhakaCharge}
              </button>
            </div>
          )}
        </section>

        {/* ── 5. Payment summary ───────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t("orders.paymentSection")}
          </p>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{t("orders.subtotal")}</span>
              <span className="font-medium text-gray-900">৳{subtotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setShowDiscountSheet(true)}
              className="text-sm text-indigo-600 font-medium"
            >
              {discountType === "NONE"
                ? t("orders.addDiscount")
                : t("orders.discountActive", {
                    summary: discountType === "PERCENT" ? `${discountValue}%` : `৳${discountValue}`,
                    amount: discountAmount.toFixed(2),
                  })}
            </button>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 flex-1">{t("orders.deliveryChargeOverride")}</label>
              <input
                type="number" inputMode="decimal" value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                className="w-24 h-9 border border-gray-200 rounded-lg text-sm px-2 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 flex-1">{t("orders.advancePaid")}</label>
              <input
                type="number" inputMode="decimal" value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-24 h-9 border border-gray-200 rounded-lg text-sm px-2 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            {parseFloat(advancePaid) > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">{t("orders.advanceMethod")}</label>
                <div className="flex gap-2">
                  {(["CASH", "BKASH", "NAGAD", "CARD"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAdvanceMethod(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        advanceMethod === m
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between text-base font-bold border-t pt-3">
              <span>{t("orders.totalCod")}</span>
              <span className="text-indigo-700">৳{total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* ── 6. Note ──────────────────────────────────────────── */}
        <section>
          <textarea
            placeholder={t("orders.notePlaceholder")}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
          />
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ── Sticky bottom bar ────────────────────────────────────── */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button
          onClick={() => createOrder.mutate(true)}
          disabled={createOrder.isPending || !canDraft}
          className="flex-1 h-12 rounded-xl border-2 border-indigo-600 text-indigo-600 font-semibold text-sm disabled:opacity-40"
        >
          {t("orders.saveDraft")}
        </button>
        <button
          onClick={() => createOrder.mutate(false)}
          disabled={createOrder.isPending || !canConfirm}
          className="flex-[2] h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
        >
          {createOrder.isPending ? t("common.saving") : `${t("orders.confirmOrder")} ৳${total.toFixed(0)}`}
        </button>
      </div>

      {/* ── Product picker slide ──────────────────────────────────── */}
      <ProductPicker
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(r) => { addToCart(r); setProductPickerOpen(false); }}
        cartVariantIds={new Set(cart.map((l) => l.variantId))}
      />

      {/* ── Customer picker slide ─────────────────────────────────── */}
      <CustomerPickerSlide
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => { setCustomer(c); setDeliveryAddress(c.address ?? ""); setCustomerPickerOpen(false); }}
        selectedPhone={customer?.phone}
      />

      {/* ── Discount bottom sheet ─────────────────────────────────── */}
      {showDiscountSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDiscountSheet(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <p className="text-base font-semibold text-gray-900">{t("orders.discountLabel")}</p>

            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(["NONE", "PERCENT", "FIXED"] as const).map((dtype) => (
                <button
                  key={dtype}
                  onClick={() => setDiscountType(dtype)}
                  className={`flex-1 py-2.5 text-sm font-medium transition ${discountType === dtype ? "bg-indigo-600 text-white" : "text-gray-600"}`}
                >
                  {dtype === "NONE" ? t("orders.discountNone") : dtype === "PERCENT" ? t("orders.discountPercent") : t("orders.discountFixed")}
                </button>
              ))}
            </div>

            {discountType !== "NONE" && (
              <div>
                <input
                  type="number" inputMode="decimal"
                  placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 50"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full h-12 border border-gray-200 rounded-xl px-4 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isOwner && safeDiscountLimit !== null && discountAmount > subtotal - subtotal * 0.1 && (
                  <p className="text-xs text-red-500 mt-1">{t("orders.safeDiscountWarning")}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  {t("orders.discountAmount")} <span className="font-semibold text-red-600">−৳{discountAmount.toFixed(2)}</span>
                </p>
              </div>
            )}

            <button
              onClick={() => setShowDiscountSheet(false)}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
            >
              {t("orders.apply")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
