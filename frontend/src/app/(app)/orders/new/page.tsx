"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createOrder as createOrderApi, listCouriers } from "@/lib/ordersApi";
import { useAuthStore } from "@/store/authStore";
import AppHeader from "@/components/layout/AppHeader";
import { XMarkIcon, PlusIcon, MinusIcon, ChevronRightIcon, Cog6ToothIcon, CubeIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";
import CustomerPickerSlide, { type SelectedCustomer } from "@/components/orders/CustomerPickerSlide";
import ProductPicker from "@/components/purchases/ProductPicker";
import type { ProductSearchResult } from "@/types/catalog";
import { useToastStore } from "@/store/toastStore";
import SlidePanel from "@/components/ui/SlidePanel";
import CourierManager from "@/components/settings/CourierManager";
import { resolveMediaUrl } from "@/lib/media";

// ── Types ──────────────────────────────────────────────────────────────────
interface CartLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  variantSku: string;
  imageUrl: string | null;
  unitPrice: number;
  marketPrice: number | null;
  qty: number;
  available: number;
}

const CHANNELS = ["FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE", "SHOP", "MYWEBSITE", "OTHER"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  FACEBOOK: "📘 Facebook",
  WHATSAPP: "💬 WhatsApp",
  INSTAGRAM: "📷 Instagram",
  PHONE: "📞 Phone",
  SHOP: "🏪 Shop",
  MYWEBSITE: "🌐 MyWebsite",
  OTHER: "Other",
};

const CHANNEL_ACTIVE_CLS: Record<Channel, string> = {
  FACEBOOK:  "bg-blue-600   text-white border-blue-600",
  WHATSAPP:  "bg-green-500  text-white border-green-500",
  INSTAGRAM: "bg-pink-600   text-white border-pink-600",
  PHONE:     "bg-slate-600  text-white border-slate-600",
  SHOP:      "bg-amber-500  text-white border-amber-500",
  MYWEBSITE: "bg-teal-600   text-white border-teal-600",
  OTHER:     "bg-gray-500   text-white border-gray-500",
};

// Unselected state — a light tint of each channel's own brand color (not plain white/gray for
// everyone) so the buttons hint at their identity even before you tap one.
const CHANNEL_INACTIVE_CLS: Record<Channel, string> = {
  FACEBOOK:  "bg-blue-200   text-blue-900   border-blue-300",
  WHATSAPP:  "bg-green-200  text-green-900  border-green-300",
  INSTAGRAM: "bg-pink-200   text-pink-900   border-pink-300",
  PHONE:     "bg-slate-300  text-slate-900  border-slate-400",
  SHOP:      "bg-amber-200  text-amber-900  border-amber-300",
  MYWEBSITE: "bg-teal-200   text-teal-900   border-teal-300",
  OTHER:     "bg-gray-300   text-gray-900   border-gray-400",
};

// Couriers come from the API (not a fixed union like Channel), so this is matched by name at
// render time instead of keyed by a known set — same idea as CHANNEL_ACTIVE/INACTIVE_CLS (bold
// fill when selected, light tint of the same hue when not), just for the well-known Bangladeshi
// couriers specifically; anything else (a courier this shop added themselves) falls back to the
// plain indigo the whole app already uses for "generic selected".
const COURIER_COLORS: { match: string; active: string; inactive: string }[] = [
  { match: "steadfast",     active: "bg-orange-600 text-white border-orange-600", inactive: "bg-orange-200 text-orange-900 border-orange-300" },
  { match: "ecourier",      active: "bg-blue-600   text-white border-blue-600",   inactive: "bg-blue-200   text-blue-900   border-blue-300" },
  { match: "paperfly",      active: "bg-purple-600 text-white border-purple-600", inactive: "bg-purple-200 text-purple-900 border-purple-300" },
  { match: "pathao",        active: "bg-green-600  text-white border-green-600", inactive: "bg-green-200  text-green-900  border-green-300" },
  { match: "redx",          active: "bg-red-600    text-white border-red-600",   inactive: "bg-red-200    text-red-900    border-red-300" },
  { match: "sa paribahan",  active: "bg-amber-600  text-white border-amber-600", inactive: "bg-amber-200  text-amber-900  border-amber-300" },
  { match: "sundarban",     active: "bg-teal-600   text-white border-teal-600",  inactive: "bg-teal-200   text-teal-900   border-teal-300" },
];
const COURIER_DEFAULT_ACTIVE = "bg-indigo-600 text-white border-indigo-600";
const COURIER_DEFAULT_INACTIVE = "bg-indigo-200 text-indigo-900 border-indigo-300";

function courierButtonClass(name: string, active: boolean): string {
  const found = COURIER_COLORS.find((c) => name.toLowerCase().includes(c.match));
  if (found) return active ? found.active : found.inactive;
  return active ? COURIER_DEFAULT_ACTIVE : COURIER_DEFAULT_INACTIVE;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function NewOrderPage() {
  const router = useRouter();
  const isOwner = useAuthStore((s) => s.isOwner());
  const { t } = useLanguage();

  // ── Cart state ──────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [showCourierManager, setShowCourierManager] = useState(false);

  // ── Customer state ──────────────────────────────────────────────────────
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  // ── Order details ───────────────────────────────────────────────────────
  const [channel, setChannel] = useState<Channel>("FACEBOOK");
  const [courierId, setCourierId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [advanceMethod, setAdvanceMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [showDiscountSheet, setShowDiscountSheet] = useState(false);

  // ── Couriers ────────────────────────────────────────────────────────────
  // GetAll returns every courier a business has (active + inactive) — that's right for the
  // settings management view, but here we're picking one to actually use, so only active ones
  // are real options.
  const { data: allCouriers = [] } = useQuery({
    queryKey: ["couriers"],
    queryFn: listCouriers,
    staleTime: 60_000,
  });
  const couriers = allCouriers.filter((c) => c.isActive);
  const selectedCourier = couriers.find((c) => c.id === courierId) ?? null;

  // ── Money calculations ──────────────────────────────────────────────────
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  // Per-product offers already baked into each line's unitPrice (vs. its marketPrice) — shown in
  // the discount sheet as "already applied" before staff considers stacking an order-level one.
  const actualPriceTotal = cart.reduce((s, l) => s + (l.marketPrice ?? l.unitPrice) * l.qty, 0);
  const existingDiscountAmount = Math.max(actualPriceTotal - subtotal, 0);
  const existingDiscountPct = actualPriceTotal > 0 ? Math.round((existingDiscountAmount / actualPriceTotal) * 100) : 0;

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
        useToastStore.getState().show(t("orders.outOfStockError", { product: result.productName }), "error");
        return prev;
      }
      return [...prev, {
        variantId: result.variantId,
        productName: result.productName,
        variantLabel,
        variantSku: result.variantSku,
        imageUrl: result.imageUrl,
        unitPrice: result.sellingPrice,
        marketPrice: result.marketPrice,
        qty: 1,
        available: result.stock,
      }];
    });
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
        discountType: discountAmount > 0 ? discountType : undefined,
        discountValue: discountAmount > 0 ? (parseFloat(discountValue) || 0) : undefined,
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
      const data = (err as { response?: { data?: { items?: string[]; message?: string } } })?.response?.data;
      const message = data?.items?.length
        ? `${t("orders.stockUnavailable")}: ${data.items.join(", ")}`
        : data?.message ?? t("orders.failedCreate");
      useToastStore.getState().show(message, "error");
    },
  });

  const canConfirm = cart.length > 0;
  const canDraft = cart.length > 0;

  return (
    <>
      <AppHeader title={t("orders.newTitle")} backHref="/orders" />

      <div className="px-4 pb-32 space-y-5 pt-4">

        {/* ── 1. Products ──────────────────────────────────────── */}
        <section className="bg-gray-100 border border-gray-400 rounded-2xl p-4">
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
              {cart.map((line) => {
                const hasDiscount = line.marketPrice != null && line.marketPrice > line.unitPrice;
                const discountPct = hasDiscount
                  ? Math.round(((line.marketPrice! - line.unitPrice) / line.marketPrice!) * 100)
                  : null;
                return (
                <div key={line.variantId} className="relative bg-indigo-50 rounded-xl border border-indigo-100 px-3 py-3 flex flex-col items-center gap-2 text-center">
                  <button onClick={() => setCart((p) => p.filter((l) => l.variantId !== line.variantId))}
                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500">
                    <XMarkIcon className="w-4 h-4" />
                  </button>

                  {/* Row 1: image (left) + product name (right) */}
                  <div className="w-full flex items-center gap-3 text-left">
                    <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center border border-indigo-100">
                      {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveMediaUrl(line.imageUrl) ?? ''} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-indigo-800">{line.productName}</p>
                      {line.variantLabel && <p className="text-xs text-indigo-400">{line.variantLabel}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">{line.variantSku}</p>
                      <span className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${
                        line.available - line.qty <= 2 ? "text-red-500" : "text-green-600"
                      }`}>
                        <CubeIcon className="w-3.5 h-3.5" />
                        {t("orders.inStockCount", { n: line.available - line.qty })}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: price (left) / quantity (right) */}
                  <div className="w-full flex items-start justify-center gap-8 bg-indigo-100/70 rounded-xl py-2.5">
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1">{t("orders.pricePerUnitLabel")}</p>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={line.unitPrice}
                        onChange={(e) => updatePrice(line.variantId, e.target.value)}
                        className="w-20 h-8 border border-gray-200 rounded-lg text-sm px-2 text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1">{t("orders.quantityLabel")}</p>
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
                      </div>
                    </div>
                  </div>

                  {hasDiscount && (
                    <div className="w-full flex items-center justify-center gap-1.5">
                      <span className="text-xs text-gray-400 line-through">
                        {t("orders.actualPriceLabel")} ৳{line.marketPrice!.toLocaleString()}
                      </span>
                      <span className="inline-block text-[11px] font-semibold px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full">
                        {discountPct}% {t("products.discountOffSuffix")}
                      </span>
                    </div>
                  )}

                  {/* Row 4: breakdown = total, one centered line */}
                  <div className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-800">
                    <span className="text-sm text-orange-200">
                      ৳{line.unitPrice.toLocaleString()} × {line.qty} {t("orders.pcsUnit")}
                    </span>
                    <span className="text-sm text-orange-200">=</span>
                    <span className="text-base font-semibold text-white">
                      {t("orders.totalLabel")} ৳{(line.unitPrice * line.qty).toFixed(2)}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Customer/Channel/Courier/Payment/Note only matter once there's actually something to
            sell — showing them against an empty cart just front-loads decisions before the one
            thing that actually determines them (what's being ordered) exists yet. */}
        {cart.length > 0 && (
        <>
        {/* ── 2. Customer ──────────────────────────────────────── */}
        <section className="bg-gray-100 border border-gray-400 rounded-2xl p-4">
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
        <section className="bg-gray-100 border border-gray-400 rounded-2xl p-4">
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
                  channel === ch ? CHANNEL_ACTIVE_CLS[ch] : CHANNEL_INACTIVE_CLS[ch]
                }`}
              >
                {CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>
        </section>

        {/* ── 4. Courier service ───────────────────────────────── */}
        <section className="bg-gray-100 border border-gray-400 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("orders.courierSection")}
            </p>
            <button
              type="button"
              onClick={() => setShowCourierManager(true)}
              className="text-gray-600 p-1 -m-1 rounded-lg active:bg-gray-200"
              aria-label={t("orders.manageCouriers")}
            >
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => { setCourierId(""); setDeliveryCharge("0"); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                courierId === "" ? "bg-gray-700 text-white border-gray-700" : "bg-gray-300 text-gray-900 border-gray-400"
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
                  courierButtonClass(c.name, courierId === c.id)
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
        <section className="bg-gray-100 border border-gray-400 rounded-2xl p-4">
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
              {discountAmount <= 0
                ? t("orders.addDiscount")
                : t("orders.discountActive", {
                    summary: discountType === "PERCENT" ? `${discountValue}%` : `৳${discountValue}`,
                    amount: discountAmount.toFixed(2),
                  })}
            </button>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 flex-1">{t("orders.deliveryChargeOverride")}</label>
              <input
                type="number" inputMode="decimal" min="0" value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                className="w-24 h-9 border border-gray-200 rounded-lg text-sm px-2 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 flex-1">{t("orders.advancePaid")}</label>
              <input
                type="number" inputMode="decimal" min="0" value={advancePaid}
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
        <section className="bg-gray-100 border border-gray-400 rounded-2xl p-4">
          <textarea
            placeholder={t("orders.notePlaceholder")}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
          />
        </section>
        </>
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
          {createOrder.isPending ? t("common.saving") : `${t("orders.confirmOrder")} ৳${total.toFixed(2)}`}
        </button>
      </div>

      {/* ── Product picker slide ──────────────────────────────────── */}
      <ProductPicker
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(r) => { addToCart(r); setProductPickerOpen(false); }}
        cartVariantIds={new Set(cart.map((l) => l.variantId))}
        showRecentlyPurchased={false}
        showSellingPrice
      />

      {/* ── Customer picker slide ─────────────────────────────────── */}
      <CustomerPickerSlide
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => { setCustomer(c); setDeliveryAddress(c.address ?? ""); setCustomerPickerOpen(false); }}
        selectedPhone={customer?.phone}
      />

      {/* ── Courier settings popup — same manager component as /more/settings/couriers,
          just opened in place so an in-progress order draft is never lost by navigating away ── */}
      <SlidePanel
        open={showCourierManager}
        onClose={() => setShowCourierManager(false)}
        title={t("orders.courierSection")}
      >
        <div className="px-4 py-4">
          <CourierManager />
        </div>
      </SlidePanel>

      {/* ── Discount bottom sheet ─────────────────────────────────── */}
      {showDiscountSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDiscountSheet(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <p className="text-base font-semibold text-gray-900">{t("orders.discountLabel")}</p>

            {/* Price breakdown — what's already applied at the product level, before staff
                considers stacking an order-level discount on top. */}
            <div className="bg-orange-800 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-200">{t("orders.actualPriceLabel")}</span>
                <span className="text-orange-100">৳{actualPriceTotal.toLocaleString()}</span>
              </div>
              {existingDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-200">{t("orders.currentOfferLabel")}</span>
                  <span className="text-white font-medium">
                    {existingDiscountPct}% = −৳{existingDiscountAmount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-1.5 border-t border-orange-700">
                <span className="font-semibold text-orange-100">{t("products.currentPriceSlotDetailsTitle")}</span>
                <span className="font-semibold text-white">৳{subtotal.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-sm text-gray-500">{t("orders.addMoreDiscountHint")}</p>

            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(["PERCENT", "FIXED"] as const).map((dtype) => (
                <button
                  key={dtype}
                  onClick={() => setDiscountType(dtype)}
                  className={`flex-1 py-2.5 text-sm font-medium transition ${discountType === dtype ? "bg-indigo-600 text-white" : "text-gray-600"}`}
                >
                  {dtype === "PERCENT" ? t("orders.discountPercent") : t("orders.discountFixed")}
                </button>
              ))}
            </div>

            {discountType !== "NONE" && (
              <div>
                <input
                  type="number" inputMode="decimal" min="0"
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

            <div className="flex gap-2">
              <button
                onClick={() => { setDiscountValue(""); setShowDiscountSheet(false); }}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
              >
                {t("orders.discountSkip")}
              </button>
              <button
                onClick={() => setShowDiscountSheet(false)}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
              >
                {t("orders.apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
