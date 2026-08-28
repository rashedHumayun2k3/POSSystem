export interface ShopContextDto {
  mode: "shop" | "marketplace";
  businessId?: string;
  shopName?: string;
  logoUrl?: string;
  bannerUrl?: string;
  websiteUrl?: string;
  websiteSettings?: StorefrontWebsiteSettings | null;
}

export interface StorefrontWebsiteSettings {
  faviconUrl?: string | null;
  sliderImageUrls?: string[] | null;
  aboutText?: string | null;
  contactPhone?: string | null;
  whatsappNumber?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  deliveryPolicy?: string | null;
  returnPolicy?: string | null;
  privacyPolicy?: string | null;
  termsPolicy?: string | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  imageUrl?: string;
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
  averageRating?: number;
  reviewCount: number;
  marketPrice?: number;
  wholesaleMinQty?: number | null; // both null/undefined = no wholesale tier for this product
  wholesaleUnitPrice?: number | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ProductSort = "default" | "popularity" | "rating" | "discount" | "wholesale";

export interface VariantDto {
  id: string;
  variantValuesJson: string;
  price: number;
  inStock: boolean;
}

export type MarketplaceDetailSection = "STYLE" | "FEATURES_SPECS" | "ITEM_DETAILS";

export interface MarketplaceDetailItem {
  section: MarketplaceDetailSection;
  label: string;
  value: string;
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
  shopSubdomain?: string;
  variants: VariantDto[];
  youtubeUrl?: string | null;
  marketplaceDetails: MarketplaceDetailItem[];
  images: string[];
  warrantyDurationValue?: number | null;
  warrantyDurationUnit?: string | null;
  wholesaleMinQty?: number | null; // both null/undefined = no wholesale tier for this product
  wholesaleUnitPrice?: number | null;
  wholesaleNote?: string | null;
}

export interface ReviewImageDto {
  id: string;
  imageUrl: string;
}

export interface ReviewReplyDto {
  body: string;
  createdAt: string;
}

export interface ProductReviewDto {
  id: string;
  rating: number;
  body: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  createdAt: string;
  images: ReviewImageDto[];
  reply?: ReviewReplyDto;
}

export interface ProductReviewSummaryDto {
  averageRating: number;
  count: number;
}

export interface ProductReviewListDto {
  summary: ProductReviewSummaryDto;
  reviews: ProductReviewDto[];
}

export interface CheckoutItem {
  variantId: string;
  qty: number;
}

export interface CheckoutRequest {
  customerName: string;
  customerPhone: string;
  buildingStreet: string;
  colonyLandmark?: string;
  city: string;
  label?: string;
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
  deliveryCharge: number;
}

export interface CheckoutResultDto {
  checkoutGroupId: string;
  shops: ShopOrderResultDto[];
}

export interface SavedShippingAddress {
  fullName: string;
  phone: string;
  buildingStreet: string;
  colonyLandmark?: string;
  city: string;
  label?: string;
}
