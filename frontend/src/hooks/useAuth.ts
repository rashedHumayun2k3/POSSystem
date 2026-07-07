"use client";

import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useBranchSelection } from "@/hooks/useBranchSelection";
import type {
  AuthResponse,
  RequestSignupCodeRequest,
  VerifySignupCodeRequest,
  VerifySignupCodeResponse,
  SignUpCompleteRequest,
  SetBusinessTypesRequest,
  SetSalesChannelsRequest,
} from "@/types/auth";

function authDebug(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[auth] ${message}`, details ?? "");
  }
}

function getErrorDetails(error: unknown) {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      url: error.config?.url,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { error };
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const resolveBranch = useBranchSelection();

  return useMutation({
    mutationFn: async (data: { phone: string; password: string }) => {
      authDebug("login request started", {
        phone: data.phone,
        passwordLength: data.password.length,
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL,
      });

      const response = await api.post<AuthResponse>("/auth/login", data);

      authDebug("login response received", {
        status: response.status,
        userId: response.data.user?.id,
        role: response.data.user?.role,
        businessCount: response.data.businesses?.length,
        firstBusinessId: response.data.businesses?.[0]?.id,
        hasAccessToken: Boolean(response.data.accessToken),
        hasRefreshToken: Boolean(response.data.refreshToken),
      });

      return response.data;
    },
    onSuccess: async (data) => {
      authDebug("login succeeded, saving auth and redirecting", {
        userId: data.user.id,
        role: data.user.role,
        businessCount: data.businesses.length,
        firstBusinessId: data.businesses[0]?.id,
      });
      setAuth(data.user, data.businesses, data.accessToken, data.refreshToken);
      await resolveBranch();
    },
    onError: (error) => {
      authDebug("login failed", getErrorDetails(error));
    },
  });
}

export function useRequestSignupCode() {
  return useMutation({
    mutationFn: async (data: RequestSignupCodeRequest) => {
      await api.post("/auth/signup/request-code", data);
    },
    onError: (error) => authDebug("signup request-code failed", getErrorDetails(error)),
  });
}

export function useVerifySignupCode() {
  return useMutation({
    mutationFn: async (data: VerifySignupCodeRequest) => {
      const response = await api.post<VerifySignupCodeResponse>("/auth/signup/verify-code", data);
      return response.data;
    },
    onError: (error) => authDebug("signup verify-code failed", getErrorDetails(error)),
  });
}

export function useCompleteSignup() {
  const { setAuth } = useAuthStore();
  const resolveBranch = useBranchSelection();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: SignUpCompleteRequest) => {
      const response = await api.post<AuthResponse>("/auth/signup/complete", data);
      return response.data;
    },
    onSuccess: async (data) => {
      setAuth(data.user, data.businesses, data.accessToken, data.refreshToken);
      await resolveBranch();
      router.replace("/onboarding/sales-channel");
    },
    onError: (error) => authDebug("signup complete failed", getErrorDetails(error)),
  });
}

export function useSetSalesChannels() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: SetSalesChannelsRequest) => {
      const response = await api.post("/onboarding/sales-channels", data);
      return response.data;
    },
    onSuccess: () => {
      router.replace("/onboarding/business-type");
    },
    onError: (error) => authDebug("set sales channels failed", getErrorDetails(error)),
  });
}

export function useSetBusinessTypes() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: SetBusinessTypesRequest) => {
      const response = await api.post("/onboarding/business-type", data);
      return response.data;
    },
    onSuccess: () => {
      router.replace("/onboarding/catalog");
    },
    onError: (error) => authDebug("set business types failed", getErrorDetails(error)),
  });
}

export function useLogout() {
  const { logout, refreshToken } = useAuthStore();
  const router = useRouter();

  return async () => {
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      // ignore
    }
    logout();
    router.replace("/login");
  };
}
