"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import {
  UsersIcon,
  TruckIcon,
  TagIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isOwner = useAuthStore((s) => s.isOwner());

  const sections = [
    {
      href: "/more/settings/staff",
      icon: UsersIcon,
      color: "bg-indigo-100 text-indigo-600",
      title: t("settings.staff"),
      desc: t("settings.staffDesc"),
    },
    {
      href: "/more/settings/couriers",
      icon: TruckIcon,
      color: "bg-blue-100 text-blue-600",
      title: t("settings.couriers"),
      desc: t("settings.couriersDesc"),
    },
    {
      href: "/more/settings/expense-categories",
      icon: TagIcon,
      color: "bg-amber-100 text-amber-600",
      title: t("settings.expenseCategories"),
      desc: t("settings.expenseCategoriesDesc"),
    },
    {
      href: "/more/settings/config",
      icon: Cog6ToothIcon,
      color: "bg-emerald-100 text-emerald-600",
      title: t("settings.businessConfig"),
      desc: t("settings.businessConfigDesc"),
    },
    // Owner-only: branch create/edit/toggle-active are OWNER-only actions server-side
    ...(isOwner
      ? [
          {
            href: "/more/settings/branches",
            icon: BuildingStorefrontIcon,
            color: "bg-teal-100 text-teal-600",
            title: t("settings.branches"),
            desc: t("settings.branchesDesc"),
          },
        ]
      : []),
    // Module 15 — Owner-only (GTR-10 / R15.10: STAFF never sees capital/profit data, not even in nav)
    ...(isOwner
      ? [
          {
            href: "/more/settings/partners",
            icon: BanknotesIcon,
            color: "bg-rose-100 text-rose-600",
            title: t("settings.partners"),
            desc: t("settings.partnersDesc"),
          },
        ]
      : []),
    // Billing is business-wide, owner-only (same rationale as Branches/Partners)
    ...(isOwner
      ? [
          {
            href: "/more/settings/subscription",
            icon: CreditCardIcon,
            color: "bg-violet-100 text-violet-600",
            title: t("settings.subscription"),
            desc: t("settings.subscriptionDesc"),
          },
        ]
      : []),
  ];

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("settings.title")}</h1>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {sections.map(({ href, icon: Icon, color, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-4 py-4 active:scale-[0.99] transition"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
