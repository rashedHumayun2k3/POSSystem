"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import {
  TruckIcon,
  BanknotesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ScaleIcon,
  UserGroupIcon,
  TagIcon,
  ArchiveBoxIcon,
  RectangleStackIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MorePage() {
  const role = useAuthStore((s) => s.user?.role);
  const isOwner    = role === "OWNER";
  const isManager  = role === "MANAGER";
  const isWarehouse = role === "WAREHOUSE";
  const { t } = useLanguage();

  const ownerLinks = [
    { href: "/more/categories", labelKey: "more.categories", Icon: TagIcon,         descKey: "more.categoriesDesc" },
    { href: "/more/catalog-templates", labelKey: "more.catalogTemplates", Icon: RectangleStackIcon, descKey: "more.catalogTemplatesDesc" },
    { href: "/more/purchases",  labelKey: "more.purchases",  Icon: TruckIcon,       descKey: "more.purchasesDesc" },
    { href: "/more/storeroom",  labelKey: "more.storeroom",  Icon: ArchiveBoxIcon,  descKey: "more.storeroomDesc" },
    { href: "/more/deliveries", labelKey: "more.deliveries", Icon: TruckIcon,       descKey: "more.deliveriesDesc" },
    { href: "/more/expenses",   labelKey: "more.expenses",   Icon: BanknotesIcon,   descKey: "more.expensesDesc" },
    { href: "/more/baki",       labelKey: "more.baki",       Icon: ScaleIcon,       descKey: "more.bakiDesc" },
    { href: "/more/reports",    labelKey: "more.reports",    Icon: ChartBarIcon,    descKey: "more.reportsDesc" },
    { href: "/more/customers",  labelKey: "more.customers",  Icon: UserGroupIcon,   descKey: "more.customersDesc" },
    { href: "/more/settings",   labelKey: "more.settings",   Icon: Cog6ToothIcon,   descKey: "more.settingsDesc" },
    { href: "/more/faq",        labelKey: "more.faq",        Icon: QuestionMarkCircleIcon, descKey: "more.faqDesc" },
    { href: "/more/feedback",   labelKey: "more.feedback",   Icon: ChatBubbleLeftRightIcon, descKey: "more.feedbackDesc" },
  ];

  const managerLinks = [
    { href: "/more/purchases",  labelKey: "more.purchases",  Icon: TruckIcon,     descKey: "more.purchasesDesc" },
    { href: "/more/deliveries", labelKey: "more.deliveries", Icon: TruckIcon,     descKey: "more.deliveriesDesc" },
    { href: "/more/expenses",   labelKey: "more.expenses",   Icon: BanknotesIcon, descKey: "more.expensesDesc" },
    { href: "/more/reports",    labelKey: "more.reports",    Icon: ChartBarIcon,  descKey: "more.reportsDesc" },
    { href: "/more/customers",  labelKey: "more.customers",  Icon: UserGroupIcon, descKey: "more.customersDesc" },
    { href: "/more/settings",   labelKey: "more.settings",   Icon: Cog6ToothIcon, descKey: "more.settingsDescStaff" },
    { href: "/more/faq",        labelKey: "more.faq",        Icon: QuestionMarkCircleIcon, descKey: "more.faqDesc" },
    { href: "/more/feedback",   labelKey: "more.feedback",   Icon: ChatBubbleLeftRightIcon, descKey: "more.feedbackDesc" },
  ];

  const warehouseLinks = [
    { href: "/more/purchases",  labelKey: "more.purchases",  Icon: TruckIcon,      descKey: "more.purchasesDesc" },
    { href: "/more/storeroom",  labelKey: "more.storeroom",  Icon: ArchiveBoxIcon, descKey: "more.storeroomDesc" },
    { href: "/more/settings",   labelKey: "more.settings",   Icon: Cog6ToothIcon,  descKey: "more.settingsDescStaff" },
    { href: "/more/faq",        labelKey: "more.faq",        Icon: QuestionMarkCircleIcon, descKey: "more.faqDesc" },
    { href: "/more/feedback",   labelKey: "more.feedback",   Icon: ChatBubbleLeftRightIcon, descKey: "more.feedbackDesc" },
  ];

  const staffLinks = [
    { href: "/more/deliveries", labelKey: "more.deliveries", Icon: TruckIcon,     descKey: "more.deliveriesDescStaff" },
    { href: "/more/settings",   labelKey: "more.settings",   Icon: Cog6ToothIcon, descKey: "more.settingsDescStaff" },
    { href: "/more/faq",        labelKey: "more.faq",        Icon: QuestionMarkCircleIcon, descKey: "more.faqDesc" },
    { href: "/more/feedback",   labelKey: "more.feedback",   Icon: ChatBubbleLeftRightIcon, descKey: "more.feedbackDesc" },
  ];

  const links = isOwner ? ownerLinks
    : isManager   ? managerLinks
    : isWarehouse ? warehouseLinks
    : staffLinks;

  return (
    <div className="px-4 py-5 space-y-3">
      {links.map(({ href, labelKey, Icon, descKey }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-4 bg-white rounded-2xl px-4 h-16 border border-gray-100 active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{t(labelKey)}</p>
            <p className="text-xs text-gray-400">{t(descKey)}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
