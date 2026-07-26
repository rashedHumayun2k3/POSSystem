export interface SuggestedCategory {
  id: string;
  businessTypeCode: string;
  name: string;
  defaultUnit: string;
  alreadyAdded: boolean;
}

export interface CategoryWithSuggestions {
  categoryId: string;
  name: string;
  availableSuggestionCount: number;
  suggestedCategoryId: string | null;
}

export interface SuggestedProduct {
  id: string;
  name: string;
  alreadyAdded: boolean;
  existingSellingPrice?: number | null;
  existingQuantity?: number | null;
}

export interface QuickAddProductItem {
  name: string;
  sellingPrice?: number;
  quantity: number;
  unitCost: number;
}

export interface AddSuggestedProductsResult {
  productId: string;
  name: string;
  stockAdded: boolean;
}
