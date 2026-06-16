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

export default function BottomTabBar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs = [
    { href: "/dashboard", labelKey: "nav.home",     Icon: HomeIcon,                   IconActive: HomeIconSolid },
    { href: "/orders",    labelKey: "nav.orders",   Icon: ClipboardDocumentListIcon,   IconActive: OrdersSolid },
    { href: "/pos",       labelKey: "nav.pos",      Icon: ShoppingCartIcon,            IconActive: PosSolid, center: true },
    { href: "/products",  labelKey: "nav.products", Icon: ArchiveBoxIcon,              IconActive: ProductsSolid },
    { href: "/more",      labelKey: "nav.more",     Icon: Bars3Icon,                   IconActive: MoreSolid },
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
