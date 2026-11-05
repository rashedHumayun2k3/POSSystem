export type ReportScope = { businessId?: string; branchId?: string; origin?: string };
export function productSalesLink(productId: string, from: string, to: string, scope: ReportScope = {}) {
  const query = new URLSearchParams({ productId, from, to });
  if (scope.businessId) query.set("businessId", scope.businessId);
  query.set("branchId", scope.branchId || "all");
  return `${scope.origin || ""}/more/reports/product-sales?${query}`;
}
