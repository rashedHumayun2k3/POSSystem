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

export interface PriceSlot {
  id: string;
  label: string;
  price: number;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
  createdByName: string;
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

