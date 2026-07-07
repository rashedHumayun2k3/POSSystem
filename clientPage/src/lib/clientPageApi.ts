import axios from "axios";
import type {
  CategoryDto,
  CheckoutRequest,
  CheckoutResultDto,
  ProductCardDto,
  ProductDetailDto,
  ShopContextDto,
  ShopSummaryDto,
} from "./types";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Every ClientPage call is scoped by an explicit ?shop= param, never by the backend guessing
// at the caller's Host — see docs/clientpage-storefront-requirements.md §2. shopSlug is null in
// marketplace mode, in which case the param is simply omitted.
function withShop(shopSlug: string | null, params?: Record<string, unknown>) {
  return shopSlug ? { ...params, shop: shopSlug } : params;
}

export async function getShopContext(shopSlug: string | null): Promise<ShopContextDto> {
  const { data } = await api.get("/clientpage/shop-context", { params: withShop(shopSlug) });
  return data;
}

export async function getCategories(shopSlug: string | null): Promise<CategoryDto[]> {
  const { data } = await api.get("/clientpage/categories", { params: withShop(shopSlug) });
  return data;
}

export async function getPopularShops(): Promise<ShopSummaryDto[]> {
  const { data } = await api.get("/clientpage/shops");
  return data;
}

export async function searchProducts(
  shopSlug: string | null,
  opts: { q?: string; categoryId?: string; onlyInStock?: boolean } = {}
): Promise<ProductCardDto[]> {
  const { data } = await api.get("/clientpage/products", { params: withShop(shopSlug, opts) });
  return data;
}

export async function getProductDetail(shopSlug: string | null, productId: string): Promise<ProductDetailDto | null> {
  try {
    const { data } = await api.get(`/clientpage/products/${productId}`, { params: withShop(shopSlug) });
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function submitCheckout(payload: CheckoutRequest): Promise<CheckoutResultDto> {
  const { data } = await api.post("/clientpage/checkout", payload);
  return data;
}
