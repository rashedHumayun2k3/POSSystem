"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getSettingsMenuItems } from "@/lib/settingsMenu";
import { REPORT_MENU_ITEMS } from "@/lib/reportsMenu";
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
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MorePage() {
  const role = useAuthStore((s) => s.user?.role);
  const isOwner    = role === "OWNER";
  const isManager  = role === "MANAGER";
  const isWarehouse = role === "WAREHOUSE";
  const isPartner = role === "PARTNER";
  const { t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const ownerLinks = [
    { href: "/more/categories", labelKey: "more.categories", Icon: TagIcon,         descKey: "more.categoriesDesc" },
    { href: "/more/catalog-templates", labelKey: "more.catalogTemplates", Icon: RectangleStackIcon, descKey: "more.catalogTemplatesDesc" },
    { href: "/more/purchases",  labelKey: "more.purchases",  Icon: TruckIcon,       descKey: "more.purchasesDesc" },
    { href: "/more/supplier-returns", labelKey: "more.supplierReturns", Icon: ArrowUturnLeftIcon, descKey: "more.supplierReturnsDesc" },
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
    { href: "/more/supplier-returns", labelKey: "more.supplierReturns", Icon: ArrowUturnLeftIcon, descKey: "more.supplierReturnsDesc" },
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

  const partnerLinks = [
    { href: "/more/settings/partners", labelKey: "partners.title", Icon: UserGroupIcon, descKey: "more.partnersApprovalDesc" },
    { href: "/more/faq", labelKey: "more.faq", Icon: QuestionMarkCircleIcon, descKey: "more.faqDesc" },
  ];

  const links = isOwner ? ownerLinks
    : isManager   ? managerLinks
    : isWarehouse ? warehouseLinks
    : isPartner   ? partnerLinks
    : staffLinks;
  const settingsItems = getSettingsMenuItems(isOwner);

  return (
    <div className="px-4 py-5 space-y-3">
      {links.map(({ href, labelKey, Icon, descKey }) => {
        if (href === "/more/reports") {
          return (
            <div key={href} className="bg-orange-100 rounded-2xl border border-orange-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setReportsOpen((open) => !open)}
                aria-expanded={reportsOpen}
                className="w-full flex items-center gap-4 px-4 h-16 active:scale-[0.98] transition text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-200">
                  <Icon className="w-5 h-5 text-orange-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t(labelKey)}</p>
                  <p className="text-xs text-gray-400">{t(descKey)}</p>
                </div>
                {reportsOpen ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-300 shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
                )}
              </button>

              {reportsOpen && (
                <div className="border-t border-orange-200 bg-orange-500 px-3 py-2 space-y-2">
                  {REPORT_MENU_ITEMS.map(({ href: childHref, icon: ChildIcon, color, title, desc }) => (
                    <Link
                      key={childHref}
                      href={childHref}
                      className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-3 border border-orange-100 active:scale-[0.99] transition"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <ChildIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        if (href === "/more/settings") {
          return (
            <div key={href} className="bg-orange-100 rounded-2xl border border-orange-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                aria-expanded={settingsOpen}
                className="w-full flex items-center gap-4 px-4 h-16 active:scale-[0.98] transition text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-200">
                  <Icon className="w-5 h-5 text-orange-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t(labelKey)}</p>
                  <p className="text-xs text-gray-400">{t(descKey)}</p>
                </div>
                {settingsOpen ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-300 shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
                )}
              </button>

              {settingsOpen && (
                <div className="border-t border-orange-200 bg-orange-500 px-3 py-2 space-y-2">
                  {settingsItems.map(({ href: childHref, icon: ChildIcon, color, titleKey, descKey }) => (
                    <Link
                      key={childHref}
                      href={childHref}
                      className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-3 border border-orange-100 active:scale-[0.99] transition"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <ChildIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t(titleKey)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t(descKey)}</p>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 bg-white rounded-2xl px-4 h-16 border border-gray-100 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50">
              <Icon className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t(labelKey)}</p>
              <p className="text-xs text-gray-400">{t(descKey)}</p>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
