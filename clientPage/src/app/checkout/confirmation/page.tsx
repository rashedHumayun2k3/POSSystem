"use client";

import Link from "next/link";
import TopHeader from "@/components/TopHeader";
import { useCheckoutResultStore } from "@/store/checkoutResultStore";

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CheckoutConfirmationPage() {
  const result = useCheckoutResultStore((s) => s.result);

  if (!result) {
    return (
      <main>
        <TopHeader />
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">No recent order to show.</p>
          <Link href="/" className="text-sm text-indigo-600">
            ← Back to shop
          </Link>
        </div>
      </main>
    );
  }

  const anySuccess = result.shops.some((s) => s.success);

  return (
    <main>
      <TopHeader />
      <div className="lg:max-w-2xl lg:mx-auto px-4 lg:px-0 py-6 flex flex-col gap-4">
        <div className="text-center">
          <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
            {anySuccess ? "Order placed!" : "We couldn't place your order"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {result.shops.length > 1
              ? "Your cart included items from multiple shops, so it was placed as separate orders below."
              : "Here's your order status."}
          </p>
        </div>

        {result.shops.map((shop) => (
          <div
            key={shop.shopId}
            className={`border rounded-xl p-4 flex items-start gap-3 ${
              shop.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                shop.success ? "bg-green-600 text-white" : "bg-red-500 text-white"
              }`}
            >
              {shop.success ? <CheckIcon /> : <XIcon />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{shop.shopName}</p>
              {shop.success ? (
                <p className="text-sm text-gray-700">
                  Order <span className="font-medium">{shop.orderNo}</span> placed — cash on delivery.
                </p>
              ) : (
                <p className="text-sm text-gray-700">{shop.errorMessage}</p>
              )}
            </div>
          </div>
        ))}

        <Link
          href="/"
          className="text-center mt-2 w-full lg:w-auto lg:mx-auto lg:px-10 rounded-lg bg-indigo-600 text-white font-medium py-3"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
