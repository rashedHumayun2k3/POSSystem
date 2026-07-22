"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  ClipboardDocumentListIcon as OrdersSolid,
  ShoppingCartIcon as PosSolid,
  ArchiveBoxIcon as ProductsSolid,
  Bars3Icon as MoreSolid,
} from "@heroicons/react/24/solid";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";

export default function BottomTabBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const businesses = useAuthStore((s) => s.businesses);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);
  const isHawker = businesses
    .find((b) => b.id === currentBusinessId)
    ?.salesChannels?.includes("HAWKER") ?? false;

  // Hawker businesses get Night Entry instead of Sell in the center slot — same tab position,
  // different destination, since the two flows are shaped too differently to share one screen.
  const sellTab = isHawker
    ? { href: "/hawker/night-entry", labelKey: "hawker.nightEntryTab", Icon: ShoppingCartIcon, IconActive: PosSolid, center: true }
    : { href: "/pos", labelKey: "nav.pos", Icon: ShoppingCartIcon, IconActive: PosSolid, center: true };

  const tabs: {
    href: string;
    labelKey: string;
    Icon: typeof HomeIcon;
    IconActive: typeof HomeIconSolid;
    center?: boolean;
  }[] = [
    { href: "/dashboard",    labelKey: "nav.home",        Icon: HomeIcon,                  IconActive: HomeIconSolid },
    { href: "/orders",       labelKey: "nav.orders",      Icon: ClipboardDocumentListIcon, IconActive: OrdersSolid },
    sellTab,
    { href: "/products",     labelKey: "nav.products",    Icon: ArchiveBoxIcon,            IconActive: ProductsSolid },
    { href: "/more",         labelKey: "nav.more",        Icon: Bars3Icon,                 IconActive: MoreSolid },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[768px] z-40 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex h-16">
        {tabs.map(({ href, labelKey, Icon, IconActive, center }) => {
          const active = pathname.startsWith(href);
          const I = active ? IconActive : Icon;
          const label = t(labelKey);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
                center ? "relative" : ""
              }`}
            >
              {center ? (
                <span className="absolute -top-5 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 shadow-lg">
                  <I className="w-7 h-7 text-white" />
                </span>
              ) : (
                <>
                  <I className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                  <span className={`text-[10px] ${active ? "text-indigo-600 font-medium" : "text-gray-400"}`}>
                    {label}
                  </span>
                </>
              )}
              {center && <span className="mt-7 text-[10px] text-gray-400">{label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
