export type CashSource = "CASH" | "BKASH" | "NAGAD" | "CARD" | "ALL";
export type CashFilter = "ALL" | "IN" | "OUT";
export type CashPeriod = "TODAY" | "7D" | "MONTH" | "CUSTOM";
// IN: sales, partner investments. OUT: refunds, expenses, purchase payments from business capital.
export type CashKind = "PAYMENT" | "REFUND" | "EXPENSE" | "PURCHASE" | "INVESTMENT" | "WITHDRAWAL";

export type CashRow = {
  id: string; referenceId: string; referenceType: "ORDER" | "EXPENSE" | "PURCHASE" | "CAPITAL" | "WITHDRAW"; kind: CashKind; source: string;
  amount: number; title: string; at: string; date: string; firstProduct?: string | null; productCount: number;
};
export type CashDay = { date: string; moneyIn: number; moneyOut: number; closing: number };
export type CashBookReport = {
  from: string; to: string; asOf: string; source: CashSource; direction: CashFilter; page: number; pageSize: number;
  opening: number; moneyIn: number; moneyOut: number; closing: number;
  salesIn: number; investmentIn: number; expenseOut: number; purchaseOut: number; refundOut: number;
  allCount: number; inCount: number; outCount: number; totalItems: number;
  days: CashDay[] | null; items: CashRow[] | null;
};

export const kindLabel: Record<CashKind, string> = {
  PAYMENT: "Sale", REFUND: "Refund", EXPENSE: "Expense", PURCHASE: "Purchase payment", INVESTMENT: "Partner investment", WITHDRAWAL: "Partner withdrawal",
};
export const sourceLabel = (source: string) => source === "BKASH" ? "bKash" : source === "NAGAD" ? "Nagad" : source === "CARD" ? "Card" : source === "ALL" ? "All" : "Cash";
export const balanceOf = (form: { cash: number; bkash: number; nagad: number }, source: string) => source === "BKASH" ? form.bkash : source === "NAGAD" ? form.nagad : form.cash;

const shift = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export function periodRange(period: Exclude<CashPeriod, "CUSTOM">, today: string) {
  if (period === "TODAY") return { from: today, to: today };
  if (period === "7D") return { from: shift(today, -6), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

// Server allows up to 366 days and never a future end date.
export function validRange(from: string, to: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "Choose both dates.";
  if (from > to) return "Start date must be on or before the end date.";
  if (to > today) return "End date cannot be in the future.";
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 365 * 86400000) return "Choose a range of up to one year.";
  return "";
}

// Rows arrive newest first; keep that order and attach each day's closing balance.
export function groupByDay(rows: CashRow[], days: CashDay[]) {
  const closing = new Map(days.map(day => [day.date, day.closing]));
  const groups: { date: string; closing: number | undefined; rows: CashRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last?.date === row.date) last.rows.push(row);
    else groups.push({ date: row.date, closing: closing.get(row.date), rows: [row] });
  }
  return groups;
}

// Strict decimal money input with at most two decimals; Bangla digits are accepted.
export function amountInput(text: string, previous: string) {
  const normalized = text.replace(/[০-৯]/g, digit => String(digit.charCodeAt(0) - 0x09e6));
  if (!/^\d{0,12}(\.\d{0,2})?$/.test(normalized)) return previous;
  return normalized.startsWith(".") ? `0${normalized}` : normalized;
}
