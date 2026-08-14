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
};

export function getSettingsMenuItems(isOwner: boolean): SettingsMenuItem[] {
  return [
    {
      href: "/more/settings/staff",
      icon: UsersIcon,
      color: "bg-indigo-100 text-indigo-600",
      titleKey: "settings.staff",
      descKey: "settings.staffDesc",
    },
    {
      href: "/more/settings/couriers",
      icon: TruckIcon,
      color: "bg-blue-100 text-blue-600",
      titleKey: "settings.couriers",
      descKey: "settings.couriersDesc",
    },
    {
      href: "/more/settings/expense-categories",
      icon: TagIcon,
      color: "bg-amber-100 text-amber-600",
      titleKey: "settings.expenseCategories",
      descKey: "settings.expenseCategoriesDesc",
    },
    {
      href: "/more/settings/config",
      icon: Cog6ToothIcon,
      color: "bg-emerald-100 text-emerald-600",
      titleKey: "settings.businessConfig",
      descKey: "settings.businessConfigDesc",
    },
    ...(isOwner
      ? [
          {
            href: "/more/settings/shop-type",
            icon: QrCodeIcon,
            color: "bg-orange-100 text-orange-600",
            titleKey: "settings.shopType",
            descKey: "settings.shopTypeDesc",
          },
          {
            href: "/more/settings/branches",
            icon: BuildingStorefrontIcon,
            color: "bg-teal-100 text-teal-600",
            titleKey: "settings.branches",
            descKey: "settings.branchesDesc",
          },
          {
            href: "/more/settings/partners",
            icon: BanknotesIcon,
            color: "bg-rose-100 text-rose-600",
            titleKey: "settings.partners",
            descKey: "settings.partnersDesc",
          },
          {
            href: "/more/settings/subscription",
            icon: CreditCardIcon,
            color: "bg-violet-100 text-violet-600",
            titleKey: "settings.subscription",
            descKey: "settings.subscriptionDesc",
          },
          {
            href: "/more/settings/storefront",
            icon: GlobeAltIcon,
            color: "bg-sky-100 text-sky-600",
            titleKey: "settings.storefront",
            descKey: "settings.storefrontDesc",
          },
          {
            href: "/more/settings/external-orders",
            icon: ArrowDownTrayIcon,
            color: "bg-rose-100 text-rose-600",
            titleKey: "settings.externalOrders",
            descKey: "settings.externalOrdersDesc",
          },
        ]
      : []),
  ];
}
