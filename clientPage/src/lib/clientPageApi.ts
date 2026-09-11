import axios from "axios";
import type {
  CategoryDto,
  CheckoutRequest,
  CheckoutResultDto,
  PagedResult,
  ProductCardDto,
  ProductDetailDto,
  ProductReviewListDto,
  ProductSort,
  ShopContextDto,
  ShopSummaryDto,
  SavedShippingAddress,
} from "./types";
import { useClientPageAuthStore } from "@/store/clientPageAuthStore";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Only reviews/Google-login calls need this — everything else on ClientPage stays anonymous.
api.interceptors.request.use((config) => {
  const token = useClientPageAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Review-photo upload is handled by the standalone ResellerApi.MediaService app, not the main
// API — separate axios instance since it talks to a different origin than `api` above.
const mediaApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_MEDIA_URL });

mediaApi.interceptors.request.use((config) => {
  const token = useClientPageAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message ?? fallback;
}

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
  opts: { q?: string; categoryId?: string; onlyInStock?: boolean; sort?: ProductSort; page?: number; pageSize?: number } = {}
): Promise<PagedResult<ProductCardDto>> {
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

export async function getRelatedProducts(
  shopSlug: string | null,
  productId: string,
  take = 8
): Promise<ProductCardDto[]> {
  const { data } = await api.get(`/clientpage/products/${productId}/related`, { params: withShop(shopSlug, { take }) });
  return data;
}

export async function submitCheckout(payload: CheckoutRequest): Promise<CheckoutResultDto> {
  const { data } = await api.post("/clientpage/checkout", payload);
  return data;
}

export async function getSavedAddress(phone: string): Promise<SavedShippingAddress | null> {
  try {
    const { data } = await api.get("/clientpage/checkout/address", { params: { phone } });
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export interface DeliveryEstimate {
  businessId: string;
  deliveryCharge: number;
}

export async function getDeliveryEstimate(businessIds: string[], city: string): Promise<DeliveryEstimate[]> {
  const { data } = await api.post("/clientpage/checkout/delivery-estimate", { businessIds, city });
  return data;
}

export async function googleLogin(idToken: string): Promise<{ accessToken: string; name: string; photoUrl: string | null }> {
  const { data } = await api.post("/clientpage/auth/google", { idToken });
  return data;
}

export async function facebookLogin(accessToken: string): Promise<{ accessToken: string; name: string; photoUrl: string | null }> {
  const { data } = await api.post("/clientpage/auth/facebook", { accessToken });
  return data;
}

export async function getReviews(productId: string): Promise<ProductReviewListDto> {
  const { data } = await api.get(`/clientpage/products/${productId}/reviews`);
  return data;
}

export async function submitReview(
  productId: string,
  payload: { rating: number; body: string; phone: string; imageUrls?: string[] }
): Promise<void> {
  await api.post(`/clientpage/products/${productId}/reviews`, payload);
}

export async function uploadReviewImage(productId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await mediaApi.post(`/api/v1/media/reviews/${productId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}
