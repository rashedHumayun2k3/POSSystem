import { api } from "./api";
import type {
  SuggestedCategory,
  CategoryWithSuggestions,
  SuggestedProduct,
  QuickAddProductItem,
  AddSuggestedProductsResult,
} from "@/types/catalogTemplates";

export const listSuggestedCategories = async (): Promise<SuggestedCategory[]> => {
  const { data } = await api.get("/catalog-templates/categories");
  return data;
};

export const addSuggestedCategories = async (suggestedCategoryIds: string[]) => {
  const { data } = await api.post("/catalog-templates/categories", { suggestedCategoryIds });
  return data;
};

export const listCategoriesWithSuggestions = async (): Promise<CategoryWithSuggestions[]> => {
  const { data } = await api.get("/catalog-templates/product-categories");
  return data;
};

export const listSuggestedProducts = async (categoryId: string): Promise<SuggestedProduct[]> => {
  const { data } = await api.get("/catalog-templates/products", { params: { categoryId } });
  return data;
};

export const addSuggestedProducts = async (payload: {
  categoryId: string;
  withQuantity: boolean;
  branchId?: string;
  items: QuickAddProductItem[];
}): Promise<AddSuggestedProductsResult[]> => {
  const { data } = await api.post("/catalog-templates/products", payload);
  return data;
};
