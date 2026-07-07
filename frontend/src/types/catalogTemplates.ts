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
}

export interface SuggestedProduct {
  id: string;
  name: string;
  alreadyAdded: boolean;
}

export interface QuickAddProductItem {
  name: string;
  sellingPrice?: number;
  quantity?: number;
  unitCost?: number;
}

export interface AddSuggestedProductsResult {
  productId: string;
  name: string;
  stockAdded: boolean;
}
