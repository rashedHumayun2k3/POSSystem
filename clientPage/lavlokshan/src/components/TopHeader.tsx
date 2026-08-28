"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShopContext } from "@/context/ShopContext";
import { useCartCount } from "@/store/cartStore";
import { resolveMediaUrl } from "@/lib/media";
import { searchProducts } from "@/lib/clientPageApi";
import { buildProductHref } from "@/lib/slug";

const SUGGESTION_MIN_CHARS = 2;
const SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 6;
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

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
  const { mode, shopName, logoUrl, shopSlug, websiteUrl } = useShopContext();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery ?? "");
  const [logoFailed, setLogoFailed] = useState(false);
  const cartCount = useCartCount();

  const [debouncedQ, setDebouncedQ] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < SUGGESTION_MIN_CHARS) {
      setDebouncedQ("");
      return;
    }
    const id = setTimeout(() => setDebouncedQ(trimmed), SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  const { data: suggestions } = useQuery({
    queryKey: ["search-suggestions", shopSlug, debouncedQ],
    queryFn: () => searchProducts(shopSlug, { q: debouncedQ }),
    enabled: debouncedQ.length >= SUGGESTION_MIN_CHARS,
  });

  // Close the dropdown on outside click — a plain onBlur would also fire when clicking a
  // suggestion itself, closing it before the click/navigation registers.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleSuggestions = showSuggestions && q.trim().length >= SUGGESTION_MIN_CHARS
    ? (suggestions?.items ?? []).slice(0, SUGGESTION_LIMIT)
    : [];

  return (
    <header className="storefront-themed-header sticky top-0 z-30 bg-indigo-600 text-white">
      {mode !== "shop" && (
        <div className="storefront-themed-header-muted flex justify-end items-center gap-3 lg:gap-4 px-2 lg:px-4 py-1 text-[11px] lg:text-xs bg-indigo-800/60">
          <Link href="/account" className="hover:text-white/80">
            Sign In
          </Link>
          <Link href="/account" className="hover:text-white/80">
            Sign Up
          </Link>
          <span className="w-px h-3 bg-white/20" />
          <a href={`${FRONTEND_URL}/signup`} className="hover:text-white/80">
            Become a Seller
          </a>
          <Link href="/seller/login" className="hover:text-white/80">
            Seller Login
          </Link>
        </div>
      )}
      {/* Below lg: stacked brand row + search row (current mobile layout). At lg+: one row —
          brand, search (grows to fill space), then text nav links replacing the bottom tab bar
          that disappears at this breakpoint. */}
      <div className="flex flex-col lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center gap-2 lg:gap-6 px-2 lg:px-4 pt-1 pb-1 lg:py-1 min-h-14 justify-center">
        <div className="flex items-center gap-2">
          {mode === "shop" ? (
            // A bare "/" always resets to the marketplace (see proxy.ts) — the shop's own home is
            // always reachable at /shop/{slug}, on-domain or not, so link there instead.
            <Link href={shopSlug ? `/shop/${shopSlug}` : "/"} className="flex items-center gap-2 shrink-0">
              {logoUrl && !logoFailed ? (
                <Image
                  src={resolveMediaUrl(logoUrl) ?? ''}
                  alt={shopName ?? "Shop"}
                  width={28}
                  height={28}
                  className="rounded-full object-cover shrink-0 bg-white/20"
                  unoptimized
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
                  {shopName?.[0] ?? "S"}
                </div>
              )}
              <span className="text-base lg:text-lg font-semibold truncate">{shopName ?? "Shop"}</span>
            </Link>
          ) : (
            <Link href="/" className="shrink-0">
              <Image
                src="/logo.png"
                alt="LavLokshan"
                width={224}
                height={224}
                className="object-contain"
              />
            </Link>
          )}
          {mode === "shop" && websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              title={websiteUrl}
              aria-label="Visit business website"
              className="hidden sm:flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 shrink-0 text-white/80"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" strokeLinecap="round" />
              </svg>
            </a>
          )}
          <Link href="/cart" aria-label="Cart" className="lg:hidden ml-auto relative p-1.5 rounded-full hover:bg-white/10 shrink-0">
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
        </div>

        <div ref={searchBoxRef} className="relative lg:w-full lg:max-w-xl lg:justify-self-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setShowSuggestions(false);
              const trimmed = q.trim();
              router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
            }}
          >
            <div className="flex items-center gap-2 bg-white rounded-full px-3.5 py-2 text-gray-500">
              <SearchIcon />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                placeholder={mode === "shop" ? `Search in ${shopName ?? "shop"}…` : "Search products…"}
                className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </form>

          {visibleSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-40 text-gray-900">
              {visibleSuggestions.map((s) => (
                <Link
                  key={s.variantId}
                  href={buildProductHref(s.productId, s.name)}
                  onClick={() => setShowSuggestions(false)}
                  className="flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                >
                  <div className="relative w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {s.imageUrl && (
                      <Image src={resolveMediaUrl(s.imageUrl) ?? ""} alt="" fill className="object-cover" unoptimized />
                    )}
                  </div>
                  <span className="text-sm text-gray-800 truncate">{s.name}</span>
                  <span className="ml-auto text-sm font-semibold text-orange-600 shrink-0">৳{s.price.toFixed(2)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium shrink-0 lg:justify-self-end">
          <Link href="/categories" className="hover:text-white/80">Categories</Link>
          <Link href="/wholesale" className="hover:text-white/80">Wholesale</Link>
          {mode === "shop" && <Link href="/about" className="hover:text-white/80">About</Link>}
          {mode === "shop" && <Link href="/contact" className="hover:text-white/80">Contact</Link>}
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
