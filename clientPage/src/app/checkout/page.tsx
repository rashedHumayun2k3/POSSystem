"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopHeader from "@/components/TopHeader";
import { useCartStore, groupByShop } from "@/store/cartStore";
import { useCheckoutResultStore } from "@/store/checkoutResultStore";
import { submitCheckout, getSavedAddress, getDeliveryEstimate } from "@/lib/clientPageApi";

const CITIES = [
  "Dhaka",
  "Chattogram",
  "Khulna",
  "Rajshahi",
  "Sylhet",
  "Barishal",
  "Rangpur",
  "Mymensingh",
  "Comilla",
  "Gazipur",
  "Narayanganj",
  "Cox's Bazar",
  "Bogura",
  "Dinajpur",
  "Jessore",
  "Faridpur",
  "Tangail",
  "Noakhali",
  "Feni",
  "Pabna",
];

const inputClass =
  "rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400";

// Cycled by group position so each shop's block is visually distinct — purely a grouping aid,
// not tied to any shop identity, so the same shop can get a different color across visits.
const GROUP_COLORS = [
  "bg-indigo-50 border-indigo-100",
  "bg-amber-50 border-amber-100",
  "bg-emerald-50 border-emerald-100",
  "bg-rose-50 border-rose-100",
  "bg-sky-50 border-sky-100",
];

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeShop = useCartStore((s) => s.removeShop);
  const setResult = useCheckoutResultStore((s) => s.setResult);
  const groups = groupByShop(items);
  const total = groups.reduce((sum, g) => sum + g.subtotal, 0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [buildingStreet, setBuildingStreet] = useState("");
  const [colonyLandmark, setColonyLandmark] = useState("");
  const [city, setCity] = useState("");
  const [label, setLabel] = useState<"Home" | "Office">("Home");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryCharges, setDeliveryCharges] = useState<Record<string, number>>({});
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const lookedUpPhone = useRef<string | null>(null);
  const shopIdsKey = groups.map((g) => g.shopId).join(",");

  // Live per-shop delivery charge, using each shop's configured Dhaka/outside-Dhaka courier
  // rate — updates as soon as a city is picked, same lookup used at final submission.
  useEffect(() => {
    if (!city || !shopIdsKey) {
      setDeliveryCharges({});
      return;
    }
    setLoadingDelivery(true);
    getDeliveryEstimate(shopIdsKey.split(","), city)
      .then((estimates) => {
        setDeliveryCharges(Object.fromEntries(estimates.map((e) => [e.businessId, e.deliveryCharge])));
      })
      .finally(() => setLoadingDelivery(false));
  }, [city, shopIdsKey]);

  // Once the phone number looks complete, check for a saved address from a previous order and
  // prefill the rest of the form — still fully editable, this is just a convenience.
  useEffect(() => {
    const trimmed = phone.trim();
    if (trimmed.length < 10 || lookedUpPhone.current === trimmed) return;
    lookedUpPhone.current = trimmed;
    getSavedAddress(trimmed).then((saved) => {
      if (!saved) return;
      setName((prev) => prev || saved.fullName);
      setBuildingStreet((prev) => prev || saved.buildingStreet);
      setColonyLandmark((prev) => prev || saved.colonyLandmark || "");
      setCity((prev) => prev || saved.city);
      if (saved.label === "Home" || saved.label === "Office") setLabel(saved.label);
    });
  }, [phone]);

  if (items.length === 0) {
    return (
      <main>
        <TopHeader />
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">Your cart is empty.</p>
          <Link href="/" className="text-sm text-indigo-600">
            ← Back to shop
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !buildingStreet.trim() || !city) {
      setError("Full name, phone, address, and city are all required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const clientUid = crypto.randomUUID();
      const result = await submitCheckout({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        buildingStreet: buildingStreet.trim(),
        colonyLandmark: colonyLandmark.trim() || undefined,
        city,
        label,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        clientUid,
      });
      setResult(result, items, phone.trim());
      for (const shop of result.shops) {
        if (shop.success) removeShop(shop.shopId);
      }
      router.push("/checkout/confirmation");
    } catch {
      setError("Something went wrong placing your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <TopHeader />
      <div className="lg:max-w-3xl lg:mx-auto px-4 lg:px-0 py-4">
        <h1 className="text-base lg:text-xl font-semibold text-gray-900 mb-4">Checkout</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Add new shipping address</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className={inputClass}
            />
            <input
              value={buildingStreet}
              onChange={(e) => setBuildingStreet(e.target.value)}
              placeholder="Building / House No / Floor / Street"
              className={inputClass}
            />
            <input
              value={colonyLandmark}
              onChange={(e) => setColonyLandmark(e.target.value)}
              placeholder="Colony / Suburb / Locality / Landmark (optional)"
              className={inputClass}
            />
            <select value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
              <option value="">Choose your city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">Select a label for effective delivery</p>
              <div className="flex gap-2">
                {(["Home", "Office"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLabel(l)}
                    className={`px-4 py-1.5 rounded-full text-sm border ${
                      label === l ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Order summary</h2>

            {groups.length > 1 && (
              <div className="flex gap-2 bg-blue-50 border border-blue-100 text-blue-800 text-xs rounded-lg px-3 py-2.5">
                <InfoIcon />
                <p>
                  You&apos;ve selected products from <span className="font-semibold">{groups.length} different shops</span>.
                  Each shop is fulfilled independently, so this will be placed as{" "}
                  <span className="font-semibold">{groups.length} separate orders</span> — each with its own delivery
                  charge, shown below in its own color.
                </p>
              </div>
            )}

            {groups.map((group, i) => (
              <div key={group.shopId} className={`flex flex-col gap-1 rounded-lg border p-3 ${GROUP_COLORS[i % GROUP_COLORS.length]}`}>
                {groups.length > 1 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Order {i + 1}</span>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{group.shopName}</span>
                  <span className="font-medium text-gray-900">৳{group.subtotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400">{group.items.length} item(s) · ships separately</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Delivery charge</span>
                  <span>
                    {!city
                      ? "Select a city"
                      : loadingDelivery
                      ? "…"
                      : `৳${(deliveryCharges[group.shopId] ?? 0).toFixed(2)}`}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-gray-100 text-sm font-semibold">
              <span>Total</span>
              <span>৳{(total + Object.values(deliveryCharges).reduce((sum, c) => sum + c, 0)).toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400">Cash on delivery.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full lg:w-auto lg:px-10 rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Placing order…" : "Place Order"}
          </button>
        </form>
      </div>
    </main>
  );
}
