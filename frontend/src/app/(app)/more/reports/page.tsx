"use client";

import Link from "next/link";
import {
  ChartBarIcon,
  CubeIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  HomeIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";

const REPORT_SECTIONS = [
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

export default function ReportsHubPage() {
  return (
    <div className="px-4 py-5 space-y-3">
      {REPORT_SECTIONS.map(({ href, icon: Icon, color, title, desc }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-4 bg-white rounded-2xl px-4 h-16 border border-gray-100 active:scale-[0.98] transition"
        >
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
