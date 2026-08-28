"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopHeader from "@/components/TopHeader";
import { useCartStore, groupByShop } from "@/store/cartStore";
import { formatVariantLabel } from "@/lib/variantLabel";
import { resolveMediaUrl } from "@/lib/media";

const CartIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
    <circle cx="9" cy="21" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="21" r="1.3" fill="currentColor" stroke="none" />
    <path d="M2.5 3h2l2.2 12.1a2 2 0 0 0 2 1.65h8.1a2 2 0 0 0 2-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const groups = groupByShop(items);
  const total = groups.reduce((sum, g) => sum + g.subtotal, 0);

  if (items.length === 0) {
    return (
      <main>
        <TopHeader />
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <CartIcon />
          <p className="text-sm font-medium text-gray-700">Your cart is empty</p>
          <Link href="/" className="mt-2 rounded-full bg-indigo-600 text-white text-sm font-medium px-5 py-2">
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <TopHeader />
      <div className="lg:max-w-3xl lg:mx-auto">
        <h1 className="px-4 lg:px-0 pt-4 pb-2 text-base lg:text-xl font-semibold text-gray-900">
          Your Cart ({items.reduce((n, i) => n + i.qty, 0)} items)
        </h1>

        {groups.map((group) => (
          <div key={group.shopId} className="mb-3 mx-4 lg:mx-0 border border-gray-100 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">{group.shopName}</div>
            {group.items.map((item) => {
              const variantLabel = formatVariantLabel(item.variantValuesJson);
              return (
                <div key={item.variantId} className="flex items-center gap-3 p-3 border-t border-gray-100">
                  <div className="relative w-16 h-16 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <Image src={resolveMediaUrl(item.imageUrl) ?? ''} alt={item.name} fill className="object-cover" unoptimized />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {variantLabel && <p className="text-xs text-gray-500">{variantLabel}</p>}
                    <p className="text-sm font-semibold text-indigo-600">৳{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center border border-gray-200 rounded-full">
                      <button
                        onClick={() => updateQty(item.variantId, item.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-600 text-sm"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-xs font-medium">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.variantId, item.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-600 text-sm"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.variantId)} className="text-xs text-red-500">
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between px-3 py-2 border-t border-gray-100 text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-900">৳{group.subtotal.toFixed(2)}</span>
            </div>
          </div>
        ))}

        <div className="mx-4 lg:mx-0 flex items-center justify-between py-3">
          <span className="text-sm font-medium text-gray-700">Total ({groups.length} shop{groups.length > 1 ? "s" : ""})</span>
          <span className="text-lg font-bold text-gray-900">৳{total.toFixed(2)}</span>
        </div>

        <div className="px-4 lg:px-0 pb-6">
          <button
            onClick={() => router.push("/checkout")}
            className="w-full lg:w-auto lg:px-10 rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </main>
  );
}
