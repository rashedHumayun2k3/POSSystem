"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopHeader from "@/components/TopHeader";
import { useCartStore, groupByShop } from "@/store/cartStore";
import { useCheckoutResultStore } from "@/store/checkoutResultStore";
import { submitCheckout } from "@/lib/clientPageApi";

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeShop = useCartStore((s) => s.removeShop);
  const setResult = useCheckoutResultStore((s) => s.setResult);
  const groups = groupByShop(items);
  const total = groups.reduce((sum, g) => sum + g.subtotal, 0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Name, phone, and address are all required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const clientUid = crypto.randomUUID();
      const result = await submitCheckout({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerAddress: address.trim(),
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        clientUid,
      });
      for (const shop of result.shops) {
        if (shop.success) removeShop(shop.shopId);
      }
      setResult(result);
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
            <h2 className="text-sm font-semibold text-gray-900">Delivery details</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
            />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Delivery address"
              rows={3}
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          <div className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Order summary</h2>
            {groups.map((group) => (
              <div key={group.shopId} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{group.shopName}</span>
                  <span className="font-medium text-gray-900">৳{group.subtotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400">{group.items.length} item(s) · ships separately</p>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-gray-100 text-sm font-semibold">
              <span>Total</span>
              <span>৳{total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400">
              Cash on delivery. Delivery charge (if any) will be confirmed by each shop before dispatch.
            </p>
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
