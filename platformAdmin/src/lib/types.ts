export interface AdminCompany {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  businessCount: number;
  userCount: number;
  planCode: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  totalFeesPaid: number;
  primaryBusinessId: string | null;
  showOnMarketplace: boolean;
}

export interface AdminStats {
  totalCompanies: number;
  newThisWeek: number;
  newThisMonth: number;
  trialingCount: number;
  activePaidCount: number;
  totalRevenueCollected: number;
}

export interface AdminFeedbackReply {
  body: string;
  createdAt: string;
  repliedByUsername: string;
}

export interface AdminFeedback {
  id: string;
  subject: string;
  details: string;
  imageUrl: string | null;
  createdAt: string;
  submittedByName: string;
  businessName: string;
  reply: AdminFeedbackReply | null; // null = unanswered
}
