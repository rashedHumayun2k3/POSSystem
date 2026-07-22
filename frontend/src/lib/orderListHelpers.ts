import type { Lang } from "@/i18n/LanguageContext";
import type { OrderListItem, OrderListItemSummary } from "@/types/orders";

export interface DateGroup {
  businessDate: string;
  orders: OrderListItem[];
  total: number;
  profit?: number; // undefined if any order in the group is missing profit (i.e. STAFF viewer)
}

// Orders already arrive sorted by BusinessDate desc (server-side), so a single pass groups
// consecutive same-date rows without needing to re-sort client-side.
export function groupByBusinessDate(orders: OrderListItem[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const order of orders) {
    const last = groups[groups.length - 1];
    if (last && last.businessDate === order.businessDate) {
      last.orders.push(order);
      last.total += order.totalAmount;
      last.profit = last.profit === undefined || order.profit === undefined
        ? undefined
        : last.profit + order.profit;
    } else {
      groups.push({ businessDate: order.businessDate, orders: [order], total: order.totalAmount, profit: order.profit });
    }
  }
  return groups;
}

const MONTH_NAMES: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

export function formatBusinessDate(dateStr: string, lang: Lang): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[lang][m - 1]} ${y}`;
}

// One fixed color per day of the week (Sun=0 .. Sat=6) — a quick visual cue for spotting
// weekly patterns (e.g. Friday/Saturday weekend sales) while scanning a long order history.
const WEEKDAY_STYLES = [
  { bg: "bg-rose-50",    border: "border-rose-100",    text: "text-rose-700",    icon: "text-rose-500" },    // Sunday
  { bg: "bg-indigo-50",  border: "border-indigo-100",  text: "text-indigo-700",  icon: "text-indigo-500" },  // Monday
  { bg: "bg-sky-50",     border: "border-sky-100",     text: "text-sky-700",     icon: "text-sky-500" },     // Tuesday
  { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700", icon: "text-emerald-500" }, // Wednesday
  { bg: "bg-amber-50",   border: "border-amber-100",   text: "text-amber-700",   icon: "text-amber-500" },   // Thursday
  { bg: "bg-fuchsia-50", border: "border-fuchsia-100", text: "text-fuchsia-700", icon: "text-fuchsia-500" }, // Friday
  { bg: "bg-orange-50",  border: "border-orange-100",  text: "text-orange-700",  icon: "text-orange-500" },  // Saturday
];

// getUTCDay (not getDay) — businessDate is a plain date string with no time component, so
// reading it in UTC avoids the weekday shifting based on the viewer's local timezone.
function weekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function weekdayStyle(dateStr: string) {
  return WEEKDAY_STYLES[weekdayIndex(dateStr)];
}

const DAY_NAMES: Record<Lang, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

export function dayName(dateStr: string, lang: Lang): string {
  return DAY_NAMES[lang][weekdayIndex(dateStr)];
}

export function itemsSummaryText(items: OrderListItemSummary[]): string {
  if (items.length === 0) return "";
  const first = items[0];
  const label = `${first.productName}${first.variantSku ? ` (${first.variantSku})` : ""}`;
  return items.length > 1 ? `${label} +${items.length - 1} more` : label;
}
