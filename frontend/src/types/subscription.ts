export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  staffSeatLimit: number;
  branchLimit: number;
  priceMonthly: number;
  priceYearly: number;
}

export interface SubscriptionStatus {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  planCode: string;
  planName: string;
  billingCycle: "MONTHLY" | "YEARLY";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  staffSeatLimit: number;
  staffSeatsUsed: number;
  branchLimit: number;
  branchesUsed: number;
  isReadOnlyLocked: boolean;
}
