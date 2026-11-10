export type ExpenseCashPayments = { cash: number; bkash: number; nagad: number };
export type CashPaymentInputs = Partial<Record<keyof ExpenseCashPayments, string>>;
export const cashMethods = ["cash", "bkash", "nagad"] as const;
export const cashMethodLabel = (method: keyof ExpenseCashPayments, bn: boolean) =>
  method === "cash" ? (bn ? "হাতে নগদ" : "Cash in Hand") : method === "bkash" ? (bn ? "বিকাশ" : "bKash") : (bn ? "নগদ" : "Nagad");
export function cashPaymentInputs(payments?: ExpenseCashPayments | null): CashPaymentInputs {
  return Object.fromEntries(cashMethods.filter(key => (payments?.[key] ?? 0) > 0).map(key => [key, String(payments![key])]));
}
export function parseCashPayments(inputs: CashPaymentInputs, amount: number, bn: boolean) {
  const selected = cashMethods.filter(key => inputs[key] !== undefined);
  const payments: ExpenseCashPayments = { cash: 0, bkash: 0, nagad: 0 };
  let error = "";
  if (!selected.length) error = bn ? "অন্তত একটি পেমেন্টের উৎস নির্বাচন করুন।" : "Select at least one payment source.";
  for (const key of selected) {
    const value = inputs[key]!.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 999999999999.99)
      error = bn ? "নির্বাচিত প্রতিটি উৎসে সঠিক টাকার পরিমাণ দিন (সর্বোচ্চ দুই দশমিক)।" : "Enter a positive amount with at most two decimal places for each selected source.";
    else payments[key] = Number(value);
  }
  const totalPaisa = cashMethods.reduce((total, key) => total + Math.round(payments[key] * 100), 0);
  if (!error && totalPaisa !== Math.round(amount * 100)) error = bn ? "পেমেন্টের মোট পরিমাণ খরচের সমান হতে হবে।" : "The payment amounts must add up to the expense total.";
  return { payments, total: totalPaisa / 100, error };
}

// Accept editable decimal amounts only; never turn invalid pasted text into a different amount.
export function expenseAmountInput(text: string, previous: string): string {
  const normalized = text.replace(/[০-৯]/g, digit => String(digit.charCodeAt(0) - 0x09e6));
  if (!/^\d{0,12}(\.\d{0,2})?$/.test(normalized)) return previous;
  return normalized.startsWith(".") ? `0${normalized}` : normalized;
}
