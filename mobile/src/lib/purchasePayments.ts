import type { PurchasePayment } from "../components/PurchasePaymentSource";
import type { PurchaseItem } from "../types/purchases";
export const legacyProductKey = "00000000-0000-0000-0000-000000000000";
export function productPayment(item: PurchaseItem, items: PurchaseItem[], payments: PurchasePayment[]) {
  const payment = payments.find(p => p.purchaseItemId === item.id);
  if (payment) return payment;
  const legacy = payments.find(p => p.costKey === legacyProductKey);
  // Historical full-PO payment is displayed as line shares, never posted again.
  if (legacy && legacy.amount === items.reduce((total, i) => total + i.totalCost, 0))
    return { ...legacy, amount: item.totalCost };
  return undefined;
}
