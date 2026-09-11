"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartCount } from "@/store/cartStore";

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CategoriesIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
);

const CartIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="21" r="1.3" fill="currentColor" stroke="none" />
    <path d="M2.5 3h2l2.2 12.1a2 2 0 0 0 2 1.65h8.1a2 2 0 0 0 2-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AccountIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1.4-3.4 4.3-5.2 7.5-5.2s6.1 1.8 7.5 5.2" strokeLinecap="round" />
  </svg>
);

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, matchExact: true },
  { href: "/categories", label: "Categories", Icon: CategoriesIcon },
  { href: "/cart", label: "Cart", Icon: CartIcon },
  { href: "/account", label: "Account", Icon: AccountIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const cartCount = useCartCount();

  return (
    <nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-200 flex z-40">
      {TABS.map(({ href, label, Icon, matchExact }) => {
        const active = matchExact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? "text-indigo-600" : "text-gray-500"
            }`}
          >
            <span className="relative">
              <Icon active={active} />
              {href === "/cart" && cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
