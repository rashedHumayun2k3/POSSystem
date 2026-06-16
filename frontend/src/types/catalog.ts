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
  defaultUnit: string | null;
  fields: CategoryField[];
}

export interface Variant {
  id: string;
  variantValuesJson: string;
  sku: string;
  barcode: string;
  priceOverride: number | null;
  isDefault: boolean;
  avgLandedCost?: number; // owner only
}

export interface ProductSummary {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  unitCode: string;
  sellingPrice: number;
  marketPrice: number | null;
  packagingCostPerUnit?: number; // owner only
  status: string;
  categoryName: string;
  variantCount: number;
  totalStock: number;
}

export interface ProductDetail {
  id: string;
  categoryId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  description: string | null;
  defectNotes: string | null;
  unitCode: string;
  sellingPrice: number;
  marketPrice: number | null;
  packagingCostPerUnit?: number; // owner only
  lowStockThreshold: number;
  attributesJson: string | null;
  note: string | null;
  status: string;
  categoryName: string;
  variants: Variant[];
}

export interface PriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedByName: string;
  reason: string;
  isScheduled: boolean;
  isRevert: boolean;
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
  variantCombinations?: Record<string, string>[] | null;
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
}

export interface ChangePricePayload {
  variantId: string;
  newPrice: number;
  reason: string;
  effectiveFrom?: string | null;
  revertAt?: string | null;
}
