import type { ComponentType, SVGProps } from "react";
import {
  ChartBarIcon,
  CubeIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  HomeIcon,
  ScaleIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

export type ReportsMenuItem = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  titleKey: string;
  descKey: string;
};

export const REPORT_MENU_ITEMS: ReportsMenuItem[] = [
  {
    href: "/more/reports/dashboard",
    icon: HomeIcon,
    color: "bg-indigo-50 text-indigo-600",
    titleKey: "reports.menu.dashboard",
    descKey: "reports.menu.dashboardDesc",
  },
  {
    href: "/more/reports/daily-closing",
    icon: EnvelopeIcon,
    color: "bg-sky-50 text-sky-600",
    titleKey: "reports.menu.dailyClosing",
    descKey: "reports.menu.dailyClosingDesc",
  },
  {
    href: "/more/reports/sales",
    icon: ChartBarIcon,
    color: "bg-emerald-50 text-emerald-600",
    titleKey: "reports.menu.sales",
    descKey: "reports.menu.salesDesc",
  },
  {
    href: "/more/reports/inventory",
    icon: CubeIcon,
    color: "bg-amber-50 text-amber-600",
    titleKey: "reports.menu.inventory",
    descKey: "reports.menu.inventoryDesc",
  },
  {
    href: "/more/reports/financial",
    icon: BanknotesIcon,
    color: "bg-purple-50 text-purple-600",
    titleKey: "reports.menu.financial",
    descKey: "reports.menu.financialDesc",
  },
  {
    href: "/more/reports/orders",
    icon: ShoppingBagIcon,
    color: "bg-rose-50 text-rose-600",
    titleKey: "reports.menu.orders",
    descKey: "reports.menu.ordersDesc",
  },
  {
    href: "/more/reports/stock-valuation",
    icon: ScaleIcon,
    color: "bg-teal-50 text-teal-600",
    titleKey: "reports.menu.stockValuation",
    descKey: "reports.menu.stockValuationDesc",
  },
];
