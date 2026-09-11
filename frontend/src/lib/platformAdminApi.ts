import axios from "axios";

// Separate axios instance from the main business-user `api` client (lib/api.ts) — platform-admin
// auth is a single 8h JWT with no refresh-token flow, and a 401 here must bounce to
// /platform-admin/login, never to the business /login page.
export const platformAdminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "platformAdminToken";

platformAdminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformAdminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/platform-admin/login")
    ) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/platform-admin/login";
    }
    return Promise.reject(error);
  }
);

export function getPlatformAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearPlatformAdminToken() {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export async function platformAdminLogin(username: string, password: string): Promise<void> {
  const { data } = await platformAdminApi.post<{ accessToken: string }>("/platform-admin/login", {
    username,
    password,
  });
  localStorage.setItem(TOKEN_KEY, data.accessToken);
}

// ── Courier catalog ──────────────────────────────────────────────────────────

export interface CourierCatalogItem {
  id: string;
  name: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  returnCharge: number;
  codFeeType: "FLAT" | "PCT";
  codFeeValue: number;
  trackingUrlTemplate: string | null;
  isActive: boolean;
  inUse: boolean;
}

export interface CourierCatalogPayload {
  name: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  returnCharge: number;
  codFeeType: "FLAT" | "PCT";
  codFeeValue: number;
  trackingUrlTemplate?: string;
  isActive: boolean;
}

export const getCourierCatalogAdmin = async (): Promise<CourierCatalogItem[]> => {
  const { data } = await platformAdminApi.get("/platform-admin/courier-catalog");
  return data;
};

export const createCourierCatalogAdmin = async (payload: CourierCatalogPayload): Promise<CourierCatalogItem> => {
  const { data } = await platformAdminApi.post("/platform-admin/courier-catalog", payload);
  return data;
};

export const updateCourierCatalogAdmin = async (id: string, payload: CourierCatalogPayload): Promise<void> => {
  await platformAdminApi.put(`/platform-admin/courier-catalog/${id}`, payload);
};

export const deleteCourierCatalogAdmin = async (id: string): Promise<void> => {
  await platformAdminApi.delete(`/platform-admin/courier-catalog/${id}`);
};
