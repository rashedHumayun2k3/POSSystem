import axios from "axios";
import { useConnectivityStore } from "@/store/connectivityStore";

function apiDebug(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    console.log(`[api] ${message}`, details ?? "");
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Extracts a human-readable message from an API error response, covering both
// shapes the backend returns: { message } for conflicts/business errors, and
// { code: "VALIDATION_ERROR", details: string[] } for FluentValidation failures.
export function getErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string; details?: string[] } } })?.response?.data;
  if (data?.message) return data.message;
  if (data?.details?.length) return data.details.join(" ");
  return fallback;
}

// Single-flight refresh — several parallel requests can all get a 401 at once when the access
// token expires (e.g. the products + categories queries firing together). Without this, each one
// would independently POST /auth/refresh with the same refresh token, and the backend's rowversion
// concurrency check would reject all but the first, wiping out a perfectly valid session (see
// AuthService.RefreshAsync). Concurrent callers now share one in-flight request instead.
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

function refreshTokens(refreshToken: string) {
  if (!refreshPromise) {
    apiDebug("refresh token request started", { baseURL: process.env.NEXT_PUBLIC_API_URL });
    refreshPromise = axios
      .post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        apiDebug("refresh token succeeded", {
          hasAccessToken: Boolean(data.accessToken),
          hasRefreshToken: Boolean(data.refreshToken),
        });
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  let token: string | null = null;
  let businessId: string | null = null;
  let branchId: string | null = null;

  if (typeof window !== "undefined") {
    token = localStorage.getItem("accessToken");
    businessId = localStorage.getItem("businessId");
    branchId = localStorage.getItem("branchId");
    const lang = localStorage.getItem("lang");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (businessId) config.headers["X-Business-Id"] = businessId;
    if (lang === "en" || lang === "bn") config.headers["X-App-Lang"] = lang;
    // Only fill in the ambient branch if the caller hasn't already set one explicitly — lets a
    // caller pin a specific branch per-request (e.g. New Order keeping every call scoped to the
    // branch it started with) regardless of what the header switcher currently says.
    if (branchId && !config.headers["X-Branch-Id"]) config.headers["X-Branch-Id"] = branchId;
  }

  apiDebug("request", {
    method: config.method,
    baseURL: config.baseURL,
    url: config.url,
    hasToken: Boolean(token),
    businessId,
    branchId,
    lang: typeof window !== "undefined" ? localStorage.getItem("lang") : null,
  });

  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => {
    apiDebug("response", {
      status: res.status,
      method: res.config.method,
      baseURL: res.config.baseURL,
      url: res.config.url,
    });
    // Any response — even an error status like 404/500 — proves the server was reached.
    useConnectivityStore.getState().setOnline(true);
    return res;
  },
  async (error) => {
    const original = error.config;
    apiDebug("response error", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
      method: original?.method,
      baseURL: original?.baseURL,
      url: original?.url,
    });

    // No response at all means the request never reached the server (network down, server
    // down, DNS failure, etc.) — a real HTTP error response means the server is reachable.
    if (!error.response) {
      useConnectivityStore.getState().setOnline(false);
    }

    if (
      error.response?.status === 402 &&
      error.response?.data?.code === "SUBSCRIPTION_EXPIRED" &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/more/settings/subscription")
    ) {
      window.location.href = "/more/settings/subscription?locked=1";
      return Promise.reject(error);
    }

    // Public auth endpoints return 401 as a normal "invalid credentials/code" business
    // response, not a signal that an authenticated session expired — the silent
    // refresh-then-redirect flow below must never fire for these, or a wrong password on the
    // login form itself gets treated like an expired session and hard-redirects the page.
    const isPublicAuthEndpoint = Boolean(
      original?.url && /\/auth\/(login|refresh|signup|forgot-password)/.test(original.url)
    );

    if (error.response?.status === 401 && original && !original._retry && !isPublicAuthEndpoint) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");
        const data = await refreshTokens(refreshToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        apiDebug("refresh token failed, clearing local auth", {
          message: refreshError instanceof Error ? refreshError.message : "Unknown refresh error",
        });
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
