export interface ShopContextDto {
  mode: "shop" | "marketplace";
  businessId?: string;
  shopName?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface CategoryDto {
  id: string;
  name: string;
}

export interface ShopSummaryDto {
  id: string;
  name: string;
  logoUrl?: string;
  subdomain?: string;
}

export interface ProductCardDto {
  productId: string;
  variantId: string;
  name: string;
  imageUrl?: string;
  unitCode: string;
  price: number;
  variantValuesJson: string;
  inStock: boolean;
  shopId: string;
  shopName: string;
}

export interface VariantDto {
  id: string;
  variantValuesJson: string;
  price: number;
  inStock: boolean;
}

export interface ProductDetailDto {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  unitCode: string;
  sellingPrice: number;
  categoryName: string;
  shopId: string;
  shopName: string;
  variants: VariantDto[];
}

export interface CheckoutItem {
  variantId: string;
  qty: number;
}

export interface CheckoutRequest {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CheckoutItem[];
  clientUid?: string;
}

export interface ShopOrderResultDto {
  shopId: string;
  shopName: string;
  success: boolean;
  orderId?: string;
  orderNo?: string;
  errorMessage?: string;
}

export interface CheckoutResultDto {
  checkoutGroupId: string;
  shops: ShopOrderResultDto[];
}
