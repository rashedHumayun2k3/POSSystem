import type { ComponentType, SVGProps } from "react";
import {
  ChartBarIcon,
  CubeIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  HomeIcon,
  ScaleIcon,
  EnvelopeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export type ReportsMenuItem = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  titleKey: string;
  descKey: string;
  keywords: string[];
};

export const REPORT_MENU_ITEMS: ReportsMenuItem[] = [
  {
    href: "/more/reports/invoices",
    icon: DocumentTextIcon,
    color: "bg-indigo-50 text-indigo-600",
    titleKey: "reports.menu.invoices",
    descKey: "reports.menu.invoicesDesc",
    keywords: ["invoice", "invoices", "invoice copy", "customer invoice", "bill", "receipt", "payment receipt", "cash memo", "memo", "ইনভয়েস", "বিল", "রশিদ"],
  },
  {
    href: "/more/reports/dashboard",
    icon: HomeIcon,
    color: "bg-indigo-50 text-indigo-600",
    titleKey: "reports.menu.dashboard",
    descKey: "reports.menu.dashboardDesc",
    keywords: ["dashboard", "overview", "business overview", "home report", "main report", "stats", "ড্যাশবোর্ড", "সারসংক্ষেপ"],
  },
  {
    href: "/more/reports/daily-closing",
    icon: EnvelopeIcon,
    color: "bg-sky-50 text-sky-600",
    titleKey: "reports.menu.dailyClosing",
    descKey: "reports.menu.dailyClosingDesc",
    keywords: ["daily report", "daily summary", "today's report", "today summary", "ajker report", "ajker hisab", "আজকের রিপোর্ট", "দৈনিক রিপোর্ট"],
  },
  {
    href: "/more/reports/sales",
    icon: ChartBarIcon,
    color: "bg-emerald-50 text-emerald-600",
    titleKey: "reports.menu.sales",
    descKey: "reports.menu.salesDesc",
    keywords: ["sales", "selling", "revenue", "sales report", "product sales", "bikri", "bikri report", "বিক্রি", "বিক্রয় রিপোর্ট", "আয়ের রিপোর্ট"],
  },
  {
    href: "/more/reports/inventory",
    icon: CubeIcon,
    color: "bg-amber-50 text-amber-600",
    titleKey: "reports.menu.inventory",
    descKey: "reports.menu.inventoryDesc",
    keywords: ["stock", "current stock", "product stock", "low stock", "inventory", "mojud", "mojud report", "স্টক", "মজুদ", "বর্তমান স্টক", "কম স্টক"],
  },
  {
    href: "/more/reports/financial",
    icon: BanknotesIcon,
    color: "bg-purple-50 text-purple-600",
    titleKey: "reports.menu.financial",
    descKey: "reports.menu.financialDesc",
    keywords: ["financial report", "profit", "loss", "P&L", "profit and loss", "expense report", "income", "taka hisab", "lav khoti", "লাভ", "ক্ষতি", "আর্থিক রিপোর্ট", "আয়-ব্যয়"],
  },
  {
    href: "/more/reports/orders",
    icon: ShoppingBagIcon,
    color: "bg-rose-50 text-rose-600",
    titleKey: "reports.menu.orders",
    descKey: "reports.menu.ordersDesc",
    keywords: ["orders", "order status", "order report", "order history", "online orders", "channel", "returns", "order dekhao", "অর্ডার", "অর্ডার হিস্টরি", "অর্ডার রিপোর্ট"],
  },
  {
    href: "/more/reports/stock-valuation",
    icon: ScaleIcon,
    color: "bg-teal-50 text-teal-600",
    titleKey: "reports.menu.stockValuation",
    descKey: "reports.menu.stockValuationDesc",
    keywords: ["stock value", "inventory value", "product value", "potential profit", "stock worth", "valuation", "mal er dam", "স্টকের মূল্য", "মজুদের দাম", "সম্ভাব্য লাভ"],
  },
];
