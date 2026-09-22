import type { ComponentType, SVGProps } from "react";
import {
  UsersIcon,
  TruckIcon,
  TagIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  CreditCardIcon,
  GlobeAltIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

export type SettingsMenuItem = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  titleKey: string;
  descKey: string;
  keywords: string[];
};

export function getSettingsMenuItems(isOwner: boolean): SettingsMenuItem[] {
  return [
    {
      href: "/more/settings/staff",
      icon: UsersIcon,
      color: "bg-indigo-100 text-indigo-600",
      titleKey: "settings.staff",
      descKey: "settings.staffDesc",
      keywords: ["staff", "employee", "employees", "users", "team members", "workers", "kormochari", "কর্মচারী", "স্টাফ", "কর্মী"],
    },
    {
      href: "/more/settings/couriers",
      icon: TruckIcon,
      color: "bg-blue-100 text-blue-600",
      titleKey: "settings.couriers",
      descKey: "settings.couriersDesc",
      keywords: ["courier", "couriers", "delivery company", "shipping partner", "delivery man", "কুরিয়ার", "ডেলিভারি কোম্পানি"],
    },
    {
      href: "/more/settings/expense-categories",
      icon: TagIcon,
      color: "bg-amber-100 text-amber-600",
      titleKey: "settings.expenseCategories",
      descKey: "settings.expenseCategoriesDesc",
      keywords: ["expense category", "expense types", "cost categories", "petty cash categories", "kharoch category", "খরচের ধরন", "খরচ ক্যাটাগরি"],
    },
    {
      href: "/more/settings/config",
      icon: Cog6ToothIcon,
      color: "bg-emerald-100 text-emerald-600",
      titleKey: "settings.businessConfig",
      descKey: "settings.businessConfigDesc",
      keywords: ["business config", "business settings", "shop settings", "general settings", "shop setup", "দোকানের সেটিংস", "ব্যবসার তথ্য"],
    },
    ...(isOwner
      ? [
          {
            href: "/more/settings/shop-type",
            icon: QrCodeIcon,
            color: "bg-orange-100 text-orange-600",
            titleKey: "settings.shopType",
            descKey: "settings.shopTypeDesc",
            keywords: ["shop type", "business type", "store type", "business category", "dokan er dhoron", "দোকানের ধরন", "ব্যবসার ধরন"],
          },
          {
            href: "/more/settings/branches",
            icon: BuildingStorefrontIcon,
            color: "bg-teal-100 text-teal-600",
            titleKey: "settings.branches",
            descKey: "settings.branchesDesc",
            keywords: ["branch", "branches", "outlet", "outlets", "shop branch", "shakha", "শাখা", "আউটলেট"],
          },
          {
            href: "/more/settings/partners",
            icon: BanknotesIcon,
            color: "bg-rose-100 text-rose-600",
            titleKey: "settings.partners",
            descKey: "settings.partnersDesc",
            keywords: ["partner", "business partner", "partnership", "investment", "installment", "co-owner", "shareholder", "ongshider", "অংশীদার", "ব্যবসার পার্টনার"],
          },
          {
            href: "/more/settings/subscription",
            icon: CreditCardIcon,
            color: "bg-violet-100 text-violet-600",
            titleKey: "settings.subscription",
            descKey: "settings.subscriptionDesc",
            keywords: ["subscription", "plan", "billing", "package", "membership", "subscription renew", "সাবস্ক্রিপশন", "প্ল্যান", "প্যাকেজ"],
          },
          {
            href: "/more/settings/storefront",
            icon: GlobeAltIcon,
            color: "bg-sky-100 text-sky-600",
            titleKey: "settings.storefront",
            descKey: "settings.storefrontDesc",
            keywords: ["storefront", "online shop", "customer website", "public store", "ecommerce", "অনলাইন দোকান", "ওয়েবসাইট স্টোর"],
          },
          {
            href: "/more/settings/external-orders",
            icon: ArrowDownTrayIcon,
            color: "bg-rose-100 text-rose-600",
            titleKey: "settings.externalOrders",
            descKey: "settings.externalOrdersDesc",
            keywords: ["website orders", "external orders", "online integration", "website connect", "site connect", "ওয়েবসাইট সংযোগ", "অনলাইন অর্ডার যুক্ত করা"],
          },
        ]
      : []),
  ];
}
