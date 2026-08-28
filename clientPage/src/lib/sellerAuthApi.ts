import axios from "axios";
import { getErrorMessage } from "./clientPageApi";

// Talks to the same /auth/* endpoints the internal staff app (/frontend) uses for
// self-service business signup — this is a SEPARATE axios instance (no customer
// review token attached) since sellers and reviewing customers are different identities.
const sellerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

export { getErrorMessage };

export async function requestSignupCode(email: string): Promise<void> {
  await sellerApi.post("/auth/signup/request-code", { email });
}

export async function verifySignupCode(email: string, code: string): Promise<void> {
  await sellerApi.post("/auth/signup/verify-code", { email, code });
}

export interface SellerAuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; phone: string; email?: string | null; role: string };
}

export async function completeSignup(payload: {
  email: string;
  name: string;
  phone: string;
  password: string;
  businessName: string;
  country?: string;
}): Promise<SellerAuthResult> {
  const { data } = await sellerApi.post("/auth/signup/complete", payload);
  return data;
}

export async function sellerLogin(phone: string, password: string): Promise<SellerAuthResult> {
  const { data } = await sellerApi.post("/auth/login", { phone, password });
  return data;
}
