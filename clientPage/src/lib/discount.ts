import type { ProductCardDto } from "./types";

export function getDiscountPercent(product: ProductCardDto): number {
  if (!product.marketPrice || product.marketPrice <= product.price) return 0;
  return Math.round(((product.marketPrice - product.price) / product.marketPrice) * 100);
}
