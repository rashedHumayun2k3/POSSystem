"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShopContext } from "@/context/ShopContext";
import { useCartCount } from "@/store/cartStore";

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" strokeLinecap="round" />
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="21" r="1.3" fill="currentColor" stroke="none" />
    <path d="M2.5 3h2l2.2 12.1a2 2 0 0 0 2 1.65h8.1a2 2 0 0 0 2-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function TopHeader({ initialQuery }: { initialQuery?: string }) {
  const { mode, shopName, logoUrl } = useShopContext();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery ?? "");
  const [logoFailed, setLogoFailed] = useState(false);
  const cartCount = useCartCount();

  return (
    <header className="sticky top-0 z-30 bg-indigo-600 text-white">
      {/* Below lg: stacked brand row + search row (current mobile layout). At lg+: one row —
          brand, search (grows to fill space), then text nav links replacing the bottom tab bar
          that disappears at this breakpoint. */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6 px-4 lg:px-8 pt-3 pb-2 lg:py-3">
        <div className="flex items-center gap-2">
          {mode === "shop" && logoUrl && !logoFailed ? (
            <Image
              src={logoUrl}
              alt={shopName ?? "Shop"}
              width={28}
              height={28}
              className="rounded-full object-cover shrink-0 bg-white/20"
              unoptimized
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
              {mode === "shop" ? (shopName?.[0] ?? "S") : "M"}
            </div>
          )}
          <Link href="/" className="text-base lg:text-lg font-semibold truncate">
            {mode === "shop" ? shopName ?? "Shop" : "Marketplace"}
          </Link>
          <Link href="/cart" aria-label="Cart" className="lg:hidden ml-auto relative p-1.5 rounded-full hover:bg-white/10 shrink-0">
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
          className="lg:flex-1 lg:max-w-xl"
        >
          <div className="flex items-center gap-2 bg-white rounded-full px-3.5 py-2 text-gray-500">
            <SearchIcon />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={mode === "shop" ? `Search in ${shopName ?? "shop"}…` : "Search products…"}
              className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
        </form>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium shrink-0">
          <Link href="/categories" className="hover:text-white/80">Categories</Link>
          <Link href="/cart" className="relative flex items-center gap-1.5 hover:text-white/80">
            <CartIcon /> Cart
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
          <Link href="/account" className="hover:text-white/80">Account</Link>
        </nav>
      </div>
    </header>
  );
}
