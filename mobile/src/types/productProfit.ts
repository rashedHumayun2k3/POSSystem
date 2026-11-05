export type ProfitTotals = { sales: number; cost: number | null; profit: number | null; units: number; marginPercent: number | null; missingCostLines: number };
export type ProductSale = { orderId: string; orderNo: string; date: string; saleType: "POS" | "ORDER"; channel: string; customerName: string; totals: ProfitTotals };
export type ProfitProduct = { id: string; name: string; totals: ProfitTotals; salesHistory?: ProductSale[] | null };
export type ProfitDay = { date: string; totals: ProfitTotals };
export type ProfitCustomer = { name: string; totals: ProfitTotals };
export type ProductProfitReport = {
  from: string; to: string; totals: ProfitTotals; daily: ProfitDay[]; products: ProfitProduct[];
  topDay: ProfitDay | null; topProduct: ProfitProduct | null;
  topBuyingCustomer: ProfitCustomer | null; topProfitCustomer: ProfitCustomer | null;
};
export const profitMoney = (value: number | null | undefined) => value == null ? "Not available" :
  `৳${Number(value).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const profitBasis = "Completed orders and paid, confirmed POS sales by recorded sale date, after product and order discounts. Draft, pending, cancelled and returned orders are excluded. Product cost uses each sale line's saved unit-cost snapshot multiplied by the sold quantity, preserving the cost recorded when that order was confirmed. Delivery charges, delivery costs and general business expenses are excluded. Returns exclude the entire returned order, including partial returns. Missing or zero saved costs make affected profit totals unavailable.";
