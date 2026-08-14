import type { ComponentType, SVGProps } from "react";
import {
  ChartBarIcon,
  CubeIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  HomeIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";

export type ReportsMenuItem = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  title: string;
  desc: string;
};

export const REPORT_MENU_ITEMS: ReportsMenuItem[] = [
  {
    href: "/more/reports/dashboard",
    icon: HomeIcon,
    color: "bg-indigo-50 text-indigo-600",
    title: "Dashboard",
    desc: "KPI cards, trends, top products",
  },
  {
    href: "/more/reports/sales",
    icon: ChartBarIcon,
    color: "bg-emerald-50 text-emerald-600",
    title: "Sales Reports",
    desc: "Revenue, orders, by product & category",
  },
  {
    href: "/more/reports/inventory",
    icon: CubeIcon,
    color: "bg-amber-50 text-amber-600",
    title: "Inventory Reports",
    desc: "Stock levels, low stock, movements",
  },
  {
    href: "/more/reports/financial",
    icon: BanknotesIcon,
    color: "bg-purple-50 text-purple-600",
    title: "Financial Reports",
    desc: "P&L, gross profit, expenses",
  },
  {
    href: "/more/reports/orders",
    icon: ShoppingBagIcon,
    color: "bg-rose-50 text-rose-600",
    title: "Order Reports",
    desc: "Status breakdown, returns, channels",
  },
  {
    href: "/more/reports/stock-valuation",
    icon: ScaleIcon,
    color: "bg-teal-50 text-teal-600",
    title: "Stock Valuation",
    desc: "Stock value, potential & realized profit by category",
  },
];
