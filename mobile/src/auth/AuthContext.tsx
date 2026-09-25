import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const API_URL = "http://127.0.0.1:5018/api/v1";
type Business = { id: string; name: string; salesChannels?: string[]; shopType?: "BIG_SUPERSHOP" | "SMALL_SHOWROOM" | "HAWKER_SHOP" | null };
export type Branch = { id: string; name: string };
type Session = { accessToken: string; refreshToken: string; user: { id?: string; name: string; phone?: string; email?: string | null; role?: string; canAccessPos?: boolean; photoUrl?: string | null }; businesses: Business[]; businessId?: string; branchId?: string; branchName?: string };
export type SignupDetails = { email: string; name: string; phone: string; password: string; businessName: string; country?: string };
const key = "lavlokshan-session";
async function save(session: Session | null) {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    if (session) window.localStorage.setItem(key, JSON.stringify(session));
    else window.localStorage.removeItem(key);
    return;
  }
  if (session) await SecureStore.setItemAsync(key, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(key);
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, signal: options.signal ?? controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || (response.status === 401 ? "Your session expired. Please sign in again." : `Request failed (${response.status}).`)), { status: response.status });
    return body;
  } catch (error) {
    if (error instanceof TypeError || (error as Error).name === "AbortError") throw new Error("Cannot reach your computer. Check the USB cable and that the .NET server is running.");
    throw error;
  } finally { clearTimeout(timer); }
}
const Context = createContext<{
  session: Session | null; ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  requestSignupCode: (email: string) => Promise<void>;
  verifySignupCode: (email: string, code: string) => Promise<void>;
  completeSignup: (details: SignupDetails) => Promise<void>;
  requestPasswordResetCode: (email: string) => Promise<void>;
  verifyPasswordResetCode: (email: string, code: string) => Promise<void>;
  completePasswordReset: (email: string, newPassword: string) => Promise<void>;
  findEmail: (phone: string, shopName: string) => Promise<{ found: boolean; maskedEmail: string | null }>;
  logout: () => Promise<void>;
  chooseBusiness: (id: string) => Promise<Branch[]>;
  chooseBranch: (branch: Branch) => Promise<void>;
  updateCurrentBusinessSalesChannels: (salesChannels: string[], shopType: Business["shopType"]) => Promise<void>;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef<Session | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useRef<Promise<Session> | null>(null);
  const update = async (value: Session | null) => { await save(value); current.current = value; setSession(value); };
  useEffect(() => {
    (async () => {
      try {
        const value = Platform.OS === "web"
          ? (typeof window !== "undefined" ? window.localStorage.getItem(key) : null)
          : await SecureStore.getItemAsync(key);
        if (value) {
          const parsed = JSON.parse(value) as Session;
          if (parsed.accessToken && parsed.refreshToken && parsed.user && Array.isArray(parsed.businesses)) {
            current.current = parsed;
            setSession(parsed);
          } else {
            await save(null);
          }
        }
      }
      catch { await save(null); }
      finally { setReady(true); }
    })().catch(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready && session) save(session).catch(() => {});
  }, [ready, session]);
  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const initial = current.current;
    if (!initial) throw new Error("Please sign in.");
    const send = (value: Session) => request<T>(path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${value.accessToken}`, ...(value.businessId ? { "X-Business-Id": value.businessId } : {}), ...(value.branchId ? { "X-Branch-Id": value.branchId } : {}), ...options.headers } });
    try { return await send(initial); }
    catch (error) {
      if ((error as { status?: number }).status !== 401) throw error;
      if (!refresh.current) refresh.current = request<{ accessToken: string; refreshToken: string }>("/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: initial.refreshToken }) })
        .then(async tokens => { if (current.current !== initial) throw new Error("Session changed. Please retry."); const next = { ...initial, ...tokens }; await update(next); return next; })
        .catch(async error => { if ((error as { status?: number }).status === 401 && current.current === initial) await update(null); throw error; })
        .finally(() => { refresh.current = null; });
      const renewed = await refresh.current;
      try { return await send(renewed); }
      catch (retryError) {
        if ((retryError as { status?: number }).status === 401 && current.current === renewed) await update(null);
        throw retryError;
      }
    }
  }
  async function chooseBusiness(id: string) {
    if (!current.current?.businesses.some(business => business.id === id)) throw new Error("Select one of your businesses.");
    await update({ ...current.current, businessId: id, branchId: undefined, branchName: undefined });
    return api<Branch[]>("/branches/mine");
  }
  return <Context.Provider value={{ session, ready, api,
    login: async (phone, password) => { const value = await request<Session>("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim(), password }) }); await update({ ...value, businessId: undefined, branchId: undefined }); },
    requestSignupCode: async email => { await request("/auth/signup/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }); },
    verifySignupCode: async (email, code) => { await request("/auth/signup/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code }) }); },
    completeSignup: async details => { const value = await request<Session>("/auth/signup/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...details, email: details.email.trim(), phone: details.phone.trim(), country: details.country?.trim() || undefined }) }); await update({ ...value, businessId: undefined, branchId: undefined }); },
    requestPasswordResetCode: async email => { await request("/auth/forgot-password/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }); },
    verifyPasswordResetCode: async (email, code) => { await request("/auth/forgot-password/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code }) }); },
    completePasswordReset: async (email, newPassword) => { await request("/auth/forgot-password/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), newPassword }) }); },
    findEmail: async (phone, shopName) => request("/auth/forgot-password/find-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim(), shopName: shopName.trim() }) }),
    logout: async () => { const previous = current.current; await update(null); if (previous) request("/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${previous.accessToken}` }, body: JSON.stringify({ refreshToken: previous.refreshToken }) }).catch(() => {}); },
    chooseBusiness,
    chooseBranch: async branch => { if (current.current) await update({ ...current.current, branchId: branch.id, branchName: branch.name }); },
    updateCurrentBusinessSalesChannels: async (salesChannels, shopType) => { if (current.current?.businessId) await update({ ...current.current, businesses: current.current.businesses.map(business => business.id === current.current?.businessId ? { ...business, salesChannels, shopType } : business) }); },
  }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthProvider missing"); return value; }


