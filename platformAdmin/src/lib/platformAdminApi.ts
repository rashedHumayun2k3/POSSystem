import { api } from "./api";
import type { AdminCompany, AdminStats, AdminFeedback } from "./types";

export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post<{ accessToken: string }>("/platform-admin/login", { username, password });
  return data.accessToken;
}

export async function getCompanies(search?: string): Promise<AdminCompany[]> {
  const { data } = await api.get<AdminCompany[]>("/platform-admin/companies", { params: { search } });
  return data;
}

export async function getStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>("/platform-admin/stats");
  return data;
}

export async function setCompanyStatus(companyId: string, status: "ACTIVE" | "SUSPENDED", note?: string): Promise<void> {
  await api.post(`/platform-admin/companies/${companyId}/status`, { status, note });
}

export async function extendSubscription(
  companyId: string,
  params: { addDays?: number; newPeriodEnd?: string; amountCollected?: number; note?: string }
): Promise<void> {
  await api.post(`/platform-admin/companies/${companyId}/extend-subscription`, params);
}

export async function setMarketplaceVisibility(companyId: string, show: boolean, note?: string): Promise<void> {
  await api.post(`/platform-admin/companies/${companyId}/marketplace-visibility`, { show, note });
}

export async function getFeedback(search?: string): Promise<AdminFeedback[]> {
  const { data } = await api.get<AdminFeedback[]>("/platform-admin/feedback", { params: { search } });
  return data;
}

export async function replyToFeedback(feedbackId: string, body: string): Promise<void> {
  await api.post(`/platform-admin/feedback/${feedbackId}/reply`, { body });
}
