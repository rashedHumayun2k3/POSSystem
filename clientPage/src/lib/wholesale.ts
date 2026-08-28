import type { ProductCardDto } from "./types";

export function hasWholesaleTier(product: ProductCardDto): boolean {
  return product.wholesaleMinQty != null && product.wholesaleUnitPrice != null;
}

export function getWholesaleDiscountPercent(product: ProductCardDto): number {
  if (!hasWholesaleTier(product) || product.price <= 0) return 0;
  return Math.round(((product.price - product.wholesaleUnitPrice!) / product.price) * 100);
}
