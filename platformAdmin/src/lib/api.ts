import axios from "axios";
import { useAdminAuthStore } from "@/store/adminAuthStore";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      useAdminAuthStore.getState().logout();
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string; details?: string[] } } })?.response?.data;
  if (data?.message) return data.message;
  if (data?.details?.length) return data.details.join(" ");
  return fallback;
}
