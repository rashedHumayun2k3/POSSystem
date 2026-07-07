import { api } from "./api";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/subscription";

export const listPlans = async (): Promise<SubscriptionPlan[]> => {
  const { data } = await api.get("/subscriptions/plans");
  return data;
};

export const getCurrentSubscription = async (): Promise<SubscriptionStatus> => {
  const { data } = await api.get("/subscriptions/current");
  return data;
};

export const startCheckout = async (
  planCode: string,
  billingCycle: "MONTHLY" | "YEARLY"
): Promise<{ bkashPaymentId: string; bkashRedirectUrl: string }> => {
  const { data } = await api.post("/subscriptions/checkout", { planCode, billingCycle });
  return data;
};
