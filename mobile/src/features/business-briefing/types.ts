export type BriefingMode = "quick" | "standard" | "detailed";
export type BriefingPreferences = { timeZone: string; businessDayCutoffHour: number; address: string; religiousGreeting: boolean; defaultMode: BriefingMode; speakingRate: number };
export type BriefingReport = {
  version: number; asOf: string; timeZone: string; scope: string; currency: string; mode: BriefingMode;
  period: { date: string; periodEnded: boolean; label: string };
  metrics: { sales: number; orders: number; deliveredFromPeriod: number; pendingDeliveries: number; lowStockVariants: number; outOfStockVariants: number; myOverdueTasks: number; approvedMonthExpenses: number; previousSales: number | null };
  segments: { id: string; text: string }[]; transcript: string; notices: string[];
};
export type PlaybackPhase = "idle" | "greeting" | "loading" | "ready" | "speaking" | "paused" | "completed" | "cancelled" | "error";
