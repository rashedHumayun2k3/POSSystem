export interface CategoryField {
  id: string;
  name: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'BOOLEAN';
  optionsJson: string | null;
  isRequired: boolean;
  isVariant: boolean;
  isPerLot: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  nameBn: string | null;
  defaultUnit: string | null;
  fields: CategoryField[];
  parentCategoryId: string | null;
  parentCategoryName: string | null;
  parentCategoryNameBn: string | null;
}

// One bucket in the product sales graph — periodStart is "YYYY-MM-DD", a day (7d/30d ranges) or
// the start of a 7-day bucket (90d/180d ranges). Revenue/Profit are Owner/Manager only server-side
// (GTR-10) — the endpoint itself 403s for STAFF, not just hidden client-side.
export interface ProductSalesPoint {
  periodStart: string;
  qty: number;
  revenue: number;
  profit: number;
  channels: ProductSalesChannelPoint[];
}

// Same bucket, split out per Order.Channel — used to flatten the sales history table into one row
// per date+channel instead of one row per date.
export interface ProductSalesChannelPoint {
  channel: string;
  qty: number;
  revenue: number;
  profit: number;
}

export interface Variant {
  id: string;
  variantValuesJson: string;
  sku: string;
  barcode: string;
  imageUrl: string | null; // null = falls back to the product's shared photo
  note: string | null;
  priceOverride: number | null;
  isDefault: boolean;
  avgLandedCost?: number; // owner only
  stock?: number; // owner only — current on-hand in the active branch scope
  rowVer?: number[]; // owner only — required for update (optimistic concurrency)
}

export type StockAdjustReason = 'EXISTING_STOCK' | 'DAMAGED' | 'LOST_THEFT' | 'RECOUNT' | 'FOUND_EXTRA' | 'OTHER';

export interface StockAdjustment {
  id: string;
  reason: StockAdjustReason;
  qty: number; // signed delta actually applied
  note: string | null;
  userName: string;
  createdAt: string;
}

export interface ReviewImage {
  id: string;
  imageUrl: string;
}

export interface ReviewReply {
  body: string;
  createdAt: string;
}

export interface AdminProductReview {
  id: string;
  rating: number;
  body: string;
  reviewerName: string;
  reviewerPhotoUrl: string | null;
  createdAt: string;
  isHidden: boolean;
  images: ReviewImage[];
  reply: ReviewReply | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  unitCode: string;
  sellingPrice: number;
  marketPrice: number | null;
  marketplacePrice: number | null; // marketplace-channel-only override, null = same as sellingPrice
  packagingCostPerUnit?: number; // owner only
  status: string;
  categoryName: string;
  variantCount: number;
  totalStock: number;
  lowStockThreshold: number;
  buyPrice?: number; // owner only — default variant's landed cost
  averageRating: number | null;
  reviewCount: number;
  orderCount: number;
  totalProfit?: number; // owner only
  showOnMarketplace: boolean;
  wholesaleMinQty: number | null; // both null = no wholesale tier for this product
  wholesaleUnitPrice: number | null;
}

export type MarketplaceDetailSection = 'STYLE' | 'FEATURES_SPECS' | 'ITEM_DETAILS';

export interface MarketplaceDetailTemplateLabel {
  section: MarketplaceDetailSection;
  label: string;
  valuePlaceholder: string | null;
  sortOrder: number;
}

export interface MarketplaceDetailItem {
  id: string;
  section: MarketplaceDetailSection;
  label: string;
  value: string;
  sortOrder: number;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ProductDetail {
  id: string;
  categoryId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  imageSource: 'COMMON' | 'INDIVIDUAL';
  suggestedProductId: string | null;
  description: string | null;
  defectNotes: string | null;
  unitCode: string;
  sellingPrice: number;
  marketPrice: number | null;
  marketplacePrice: number | null; // marketplace-channel-only override, null = same as sellingPrice
  packagingCostPerUnit?: number; // owner only
  lowStockThreshold: number;
  attributesJson: string | null;
  note: string | null;
  status: string;
  categoryName: string;
  variants: Variant[];
  rowVer?: number[]; // owner only — required for update (optimistic concurrency)
  showOnMarketplace?: boolean; // owner only — controls ClientPage marketplace visibility
  youtubeUrl: string | null;
  marketplaceDetails: MarketplaceDetailItem[];
  images: ProductImage[];
  warrantyDurationValue: number | null;
  warrantyDurationUnit: string | null;
  averageRating: number | null;
  reviewCount: number;
  wholesaleMinQty: number | null; // both null = no wholesale tier
  wholesaleUnitPrice: number | null;
  wholesaleNote: string | null;
}

export interface PriceSlot {
  id: string;
  label: string;
  price: number;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
  createdByName: string;
  startDate: string;
  endDate: string | null;
}

export interface PriceActivationLog {
  id: string;
  slotId: string;
  labelSnapshot: string;
  priceSnapshot: number;
  activatedAt: string;
  deactivatedAt: string | null;
  activatedByName: string;
}

export interface CreateSlotPayload {
  label: string;
  newPrice: number;
  reason?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface VariantCombinationInput {
  values: Record<string, string>;
  qty: number;
  costPrice: number;
}

export interface SplitVariantItem {
  values: Record<string, string>;
  qty: number;
}

export interface SplitStockIntoVariantsPayload {
  sourceVariantId: string;
  items: SplitVariantItem[];
  branchId?: string | null;
}

export interface CreateProductPayload {
  categoryId: string;
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  defectNotes?: string | null;
  unitCode: string;
  sellingPrice: number;
  marketPrice?: number | null;
  packagingCostPerUnit: number;
  lowStockThreshold: number;
  attributesJson?: string | null;
  note?: string | null;
  variantCombinations?: VariantCombinationInput[] | null;
  branchId?: string | null;
  warrantyDurationValue?: number | null;
  warrantyDurationUnit?: string | null;
  wholesaleMinQty?: number | null;
  wholesaleUnitPrice?: number | null;
  wholesaleNote?: string | null;
  suggestedProductId?: string | null;
}

export interface ProductSearchResult {
  productId: string;
  variantId: string;
  productName: string;
  variantSku: string;
  barcode: string;
  sellingPrice: number;
  imageUrl: string | null;
  unitCode: string | null;
  variantValuesJson: string;
  stock: number;
  avgLandedCost: number;
  marketPrice: number | null;
  wholesaleMinQty: number | null; // both null = no wholesale tier
  wholesaleUnitPrice: number | null;
  categoryId: string;
}

