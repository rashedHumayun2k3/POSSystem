import { api } from './api';
import type {
  Category,
  CategoryField,
  ProductSummary,
  ProductDetail,
  ProductSearchResult,
  PriceHistoryEntry,
  CreateProductPayload,
  ChangePricePayload,
} from '@/types/catalog';

// ── Categories ────────────────────────────────────────────────────────────────

export const getCategories = async (): Promise<Category[]> => {
  const { data } = await api.get('/categories');
  return data;
};

export const getCategory = async (id: string): Promise<Category> => {
  const { data } = await api.get(`/categories/${id}`);
  return data;
};

export const createCategory = async (payload: { name: string; defaultUnit?: string }): Promise<Category> => {
  const { data } = await api.post('/categories', payload);
  return data;
};

export const updateCategory = async (id: string, payload: { name: string; defaultUnit?: string }): Promise<Category> => {
  const { data } = await api.put(`/categories/${id}`, payload);
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete(`/categories/${id}`);
};

export const addCategoryField = async (
  categoryId: string,
  payload: Omit<CategoryField, 'id'>
): Promise<CategoryField> => {
  const { data } = await api.post(`/categories/${categoryId}/fields`, payload);
  return data;
};

export const updateCategoryField = async (
  categoryId: string,
  fieldId: string,
  payload: Omit<CategoryField, 'id'>
): Promise<CategoryField> => {
  const { data } = await api.put(`/categories/${categoryId}/fields/${fieldId}`, payload);
  return data;
};

export const deleteCategoryField = async (categoryId: string, fieldId: string): Promise<void> => {
  await api.delete(`/categories/${categoryId}/fields/${fieldId}`);
};

// ── Products ──────────────────────────────────────────────────────────────────

export const getProducts = async (params?: {
  status?: string;
  categoryId?: string;
  q?: string;
}): Promise<ProductSummary[]> => {
  const { data } = await api.get('/products', { params });
  return data;
};

export const getActiveCategories = async (): Promise<{ id: string; name: string }[]> => {
  const { data } = await api.get('/products/active-categories');
  return data;
};

type RawSearchResult = {
  id: string;
  variantId: string;
  name: string;
  sku: string;
  barcode: string;
  effectivePrice: number;
  imageUrl?: string | null;
  unitCode?: string | null;
  variantValuesJson: string;
  stock: number;
  avgLandedCost: number;
};

function mapSearchResult(item: RawSearchResult): ProductSearchResult {
  return {
    productId: item.id,
    variantId: item.variantId,
    productName: item.name,
    variantSku: item.sku,
    barcode: item.barcode,
    sellingPrice: item.effectivePrice,
    imageUrl: item.imageUrl ?? null,
    unitCode: item.unitCode ?? null,
    variantValuesJson: item.variantValuesJson,
    stock: item.stock,
    avgLandedCost: item.avgLandedCost,
  };
}

export const browseProducts = async (categoryId?: string): Promise<ProductSearchResult[]> => {
  const { data } = await api.get<RawSearchResult[]>('/products/browse', {
    params: categoryId ? { categoryId } : undefined,
  });
  return data.map(mapSearchResult);
};

export const getRecentlyPurchasedProducts = async (limit = 5): Promise<ProductSearchResult[]> => {
  const { data } = await api.get<RawSearchResult[]>('/products/recently-purchased', {
    params: { limit },
  });
  return data.map(mapSearchResult);
};

export const searchProducts = async (q: string): Promise<ProductSearchResult[]> => {
  const { data } = await api.get<RawSearchResult[]>('/products/search', { params: { q } });
  return data.map(mapSearchResult);
};

export const getProduct = async (id: string): Promise<ProductDetail> => {
  const { data } = await api.get(`/products/${id}`);
  return data;
};

export const createProduct = async (payload: CreateProductPayload): Promise<ProductDetail> => {
  const { data } = await api.post('/products', payload);
  return data;
};

export const updateProduct = async (
  id: string,
  payload: Partial<CreateProductPayload> & { status?: string; rowVer: number[] }
): Promise<ProductDetail> => {
  const { data } = await api.put(`/products/${id}`, payload);
  return data;
};

export const archiveProduct = async (id: string): Promise<void> => {
  await api.patch(`/products/${id}/archive`);
};

// ── Price history ─────────────────────────────────────────────────────────────

export const getPriceHistory = async (variantId: string): Promise<PriceHistoryEntry[]> => {
  const { data } = await api.get(`/products/variants/${variantId}/prices`);
  return data;
};

export const changePrice = async (variantId: string, payload: ChangePricePayload): Promise<PriceHistoryEntry> => {
  const { data } = await api.post(`/products/variants/${variantId}/prices`, payload);
  return data;
};

// ── Units ─────────────────────────────────────────────────────────────────────

export const getUnits = async (): Promise<{ code: string; name: string; allowsDecimal: boolean }[]> => {
  const { data } = await api.get('/units');
  return data;
};
