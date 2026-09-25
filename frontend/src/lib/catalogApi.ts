import { api } from './api';
import type {
  Category,
  CategoryField,
  ProductSummary,
  ProductDetail,
  ProductSearchResult,
  PriceSlot,
  PriceActivationLog,
  CreateSlotPayload,
  CreateProductPayload,
  Variant,
  StockAdjustment,
  StockAdjustReason,
  AdminProductReview,
  MarketplaceDetailSection,
  MarketplaceDetailTemplateLabel,
  ProductImage,
  SplitStockIntoVariantsPayload,
  ProductSalesPoint,
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

export const createCategory = async (payload: { name: string; nameBn?: string | null; defaultUnit?: string; parentCategoryId?: string | null }): Promise<Category> => {
  const { data } = await api.post('/categories', payload);
  return data;
};

export const updateCategory = async (id: string, payload: { name: string; nameBn?: string | null; defaultUnit?: string; parentCategoryId?: string | null }): Promise<Category> => {
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
  marketPrice?: number | null;
  wholesaleMinQty?: number | null;
  wholesaleUnitPrice?: number | null;
  categoryId: string;
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
    marketPrice: item.marketPrice ?? null,
    wholesaleMinQty: item.wholesaleMinQty ?? null,
    wholesaleUnitPrice: item.wholesaleUnitPrice ?? null,
    categoryId: item.categoryId,
  };
}

// branchId: explicit per-request override of X-Branch-Id — see api.ts's interceptor, which only
// fills in the ambient header when the caller hasn't already set one. Used by New Order to keep
// stock figures pinned to the branch the order started with, regardless of the header switcher.
export const browseProducts = async (categoryId?: string, onlyInStock = false, branchId?: string): Promise<ProductSearchResult[]> => {
  const { data } = await api.get<RawSearchResult[]>('/products/browse', {
    params: { ...(categoryId ? { categoryId } : {}), ...(onlyInStock ? { onlyInStock } : {}) },
    headers: branchId ? { 'X-Branch-Id': branchId } : undefined,
  });
  return data.map(mapSearchResult);
};

export const getRecentlyPurchasedProducts = async (limit = 5): Promise<ProductSearchResult[]> => {
  const { data } = await api.get<RawSearchResult[]>('/products/recently-purchased', {
    params: { limit },
  });
  return data.map(mapSearchResult);
};

export const searchProducts = async (q: string, onlyInStock = false, branchId?: string): Promise<ProductSearchResult[]> => {
  const { data } = await api.get<RawSearchResult[]>('/products/search', {
    params: { q, ...(onlyInStock ? { onlyInStock } : {}) },
    headers: branchId ? { 'X-Branch-Id': branchId } : undefined,
  });
  return data.map(mapSearchResult);
};

// variantId -> { qty, amount } sold today (business-scoped), for the hawker night-entry tile grid.
// amount is the actual revenue at whatever price each sale went through at, not qty * today's
// listed price — Night Entry lets a seller override the price per sale.
export interface TodaySold {
  qty: number;
  amount: number;
}

export const getTodaySoldByVariant = async (): Promise<Record<string, TodaySold>> => {
  const { data } = await api.get<Record<string, TodaySold>>('/products/today-sold');
  return data;
};

// Owner/Manager only (403 for anyone else) — today's Night Entry (HAWKER channel) profit total.
export const getTodayHawkerProfit = async (): Promise<number> => {
  const { data } = await api.get<number>('/products/today-hawker-profit');
  return data;
};

export const lookupBarcode = async (barcode: string, branchId?: string): Promise<ProductSearchResult> => {
  const { data } = await api.get<RawSearchResult>(`/products/barcode/${encodeURIComponent(barcode)}`, {
    headers: branchId ? { 'X-Branch-Id': branchId } : undefined,
  });
  return mapSearchResult(data);
};

export const getProduct = async (id: string): Promise<ProductDetail> => {
  const { data } = await api.get(`/products/${id}`);
  return data;
};

export type SalesTimeseriesRange = '7d' | '30d' | '90d' | '180d';

export const getProductSalesTimeseries = async (
  id: string,
  range: SalesTimeseriesRange
): Promise<ProductSalesPoint[]> => {
  const { data } = await api.get(`/products/${id}/sales-timeseries`, { params: { range } });
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

export const setProductMarketplaceVisibility = async (id: string, show: boolean): Promise<{ showOnMarketplace: boolean }> => {
  const { data } = await api.patch(`/products/${id}/marketplace-visibility`, { show });
  return data;
};

export const updateMarketplaceDetails = async (
  id: string,
  payload: {
    youtubeUrl: string | null;
    details: { section: MarketplaceDetailSection; label: string; value: string; sortOrder: number }[];
    marketplacePrice: number | null;
  }
): Promise<void> => {
  await api.put(`/products/${id}/marketplace-details`, payload);
};

export const getMarketplaceDetailTemplates = async (categoryId: string): Promise<MarketplaceDetailTemplateLabel[]> => {
  const { data } = await api.get('/products/marketplace-detail-templates', { params: { categoryId } });
  return data;
};

// ── Gallery images ───────────────────────────────────────────────────────────

export const addProductImage = async (id: string, imageUrl: string): Promise<ProductImage> => {
  const { data } = await api.post(`/products/${id}/images`, { imageUrl });
  return data;
};

export const removeProductImage = async (id: string, imageId: string): Promise<void> => {
  await api.delete(`/products/${id}/images/${imageId}`);
};

export const reorderProductImages = async (id: string, imageIdsInOrder: string[]): Promise<void> => {
  await api.put(`/products/${id}/images/reorder`, { imageIdsInOrder });
};

// ── Variants ──────────────────────────────────────────────────────────────────

export const addVariant = async (
  productId: string,
  payload: {
    variantValuesJson: string; barcode: string | null; imageUrl: string | null; note: string | null;
    priceOverride: number | null; isDefault: boolean; qty: number; costPrice: number; branchId?: string | null;
  }
): Promise<Variant> => {
  const { data } = await api.post(`/products/${productId}/variants`, payload);
  return data;
};

export const splitStockIntoVariants = async (
  productId: string,
  payload: SplitStockIntoVariantsPayload
): Promise<Variant[]> => {
  const { data } = await api.post(`/products/${productId}/variants/split`, payload);
  return data;
};

export const updateVariant = async (
  productId: string,
  variantId: string,
  payload: { imageUrl: string | null; note: string | null; priceOverride: number | null; isDefault: boolean; rowVer: number[] }
): Promise<Variant> => {
  const { data } = await api.put(`/products/${productId}/variants/${variantId}`, payload);
  return data;
};

// ── Stock adjustments ──────────────────────────────────────────────────────────

export const getStockAdjustments = async (variantId: string): Promise<StockAdjustment[]> => {
  const { data } = await api.get(`/products/variants/${variantId}/stock-adjustments`);
  return data;
};

export const adjustStock = async (
  variantId: string,
  payload: { reason: StockAdjustReason; mode: 'SET' | 'DELTA'; value: number; note: string | null }
): Promise<StockAdjustment> => {
  const { data } = await api.post(`/products/variants/${variantId}/stock-adjustments`, payload);
  return data;
};

export const recordExistingStockCost = async (
  variantId: string,
  payload: { qty: number; costPerUnit: number; branchId?: string | null }
): Promise<Variant> => {
  const { data } = await api.post(`/products/variants/${variantId}/existing-stock-cost`, payload);
  return data;
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export const getProductReviews = async (productId: string): Promise<AdminProductReview[]> => {
  const { data } = await api.get(`/products/${productId}/reviews`);
  return data;
};

export const replyToReview = async (productId: string, reviewId: string, body: string): Promise<void> => {
  await api.post(`/products/${productId}/reviews/${reviewId}/reply`, { body });
};

export const deleteReviewReply = async (productId: string, reviewId: string): Promise<void> => {
  await api.delete(`/products/${productId}/reviews/${reviewId}/reply`);
};

export const setReviewHidden = async (productId: string, reviewId: string, hidden: boolean): Promise<void> => {
  await api.patch(`/products/${productId}/reviews/${reviewId}/hide`, hidden);
};

// ── Price slots ───────────────────────────────────────────────────────────────

export const getPriceSlots = async (variantId: string): Promise<PriceSlot[]> => {
  const { data } = await api.get(`/products/variants/${variantId}/slots`);
  return data;
};

export const createPriceSlot = async (variantId: string, payload: CreateSlotPayload): Promise<PriceSlot> => {
  const { data } = await api.post(`/products/variants/${variantId}/slots`, payload);
  return data;
};

export const activatePriceSlot = async (variantId: string, slotId: string): Promise<void> => {
  await api.post(`/products/variants/${variantId}/slots/${slotId}/activate`);
};

export const deletePriceSlot = async (variantId: string, slotId: string): Promise<void> => {
  await api.delete(`/products/variants/${variantId}/slots/${slotId}`);
};

export const getPriceSlotHistory = async (variantId: string): Promise<PriceActivationLog[]> => {
  const { data } = await api.get(`/products/variants/${variantId}/slot-history`);
  return data;
};

// ── Units ─────────────────────────────────────────────────────────────────────

export const getUnits = async (): Promise<{ code: string; name: string; allowsDecimal: boolean }[]> => {
  const { data } = await api.get('/units');
  return data;
};

export const downloadBarcodeLabels = async (
  productId: string,
  qty: number,
  variantId?: string
): Promise<void> => {
  const params: Record<string, string | number> = { qty };
  if (variantId) params.variantId = variantId;
  const response = await api.get(`/products/${productId}/barcode-labels`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `labels-${productId}.pdf`;
    a.click();
  }
};

export type BarcodeLabelBatchPayload = {
  mode: 'A4' | 'ROLL';
  items: Array<{ variantId: string; quantity: number }>;
  a4?: {
    labelWidth: number; labelHeight: number; columns: number; rows: number;
    horizontalGap: number; verticalGap: number;
    marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
  };
  roll?: { width: number; height: number };
  startPosition: number;
  email?: string;
};

export const createBarcodeLabelBatchPdf = async (payload: BarcodeLabelBatchPayload): Promise<Blob> => {
  try {
    const response = await api.post('/products/barcode-labels/batch', payload, { responseType: 'blob' });
    return new Blob([response.data], { type: 'application/pdf' });
  } catch (error) {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
      let parsed: { message?: string } | null = null;
      try { parsed = JSON.parse(await data.text()) as { message?: string }; } catch { /* non-JSON error body */ }
      if (parsed?.message) throw new Error(parsed.message);
    }
    throw error;
  }
};

export const sendBarcodeLabelBatchPdf = async (payload: BarcodeLabelBatchPayload, email: string): Promise<string> => {
  const { data } = await api.post('/products/barcode-labels/batch/send', { ...payload, email });
  return data.message;
};
