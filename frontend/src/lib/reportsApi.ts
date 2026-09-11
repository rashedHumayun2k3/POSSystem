import { api } from "./api";
import type { DashboardKpi, HomeSummary, SalesSummary, InventoryReport, PnlReport, OrdersReport, StockValuationResponse, DailyClosingReport } from "@/types/reports";

function currentLang(explicit?: string) {
  if (explicit === "bn" || explicit === "en") return explicit;
  if (typeof document !== "undefined") {
    const docLang = document.documentElement.getAttribute("data-lang");
    if (docLang === "bn" || docLang === "en") return docLang;
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("lang");
    if (stored === "bn" || stored === "en") return stored;
  }
  return "en";
}

export const getDashboard = async (): Promise<DashboardKpi> => {
  const { data } = await api.get("/reports/dashboard");
  return data;
};

export const getHomeSummary = async (): Promise<HomeSummary> => {
  const { data } = await api.get("/reports/home-summary");
  return data;
};

export const getSalesSummary = async (params: {
  from?: string;
  to?: string;
  groupBy?: string;
}): Promise<SalesSummary> => {
  const { data } = await api.get("/reports/sales", { params });
  return data;
};

export const getInventoryReport = async (params: {
  from?: string;
  to?: string;
  groupBy?: string;
}): Promise<InventoryReport> => {
  const { data } = await api.get("/reports/inventory", { params });
  return data;
};

export const getPnlReport = async (params: {
  from?: string;
  to?: string;
  groupBy?: string;
}): Promise<PnlReport> => {
  const { data } = await api.get("/reports/financial", { params });
  return data;
};

export const getOrdersReport = async (params: {
  from?: string;
  to?: string;
  groupBy?: string;
}): Promise<OrdersReport> => {
  const { data } = await api.get("/reports/orders", { params });
  return data;
};

export const getDailyClosingReport = async (params: {
  date?: string;
}): Promise<DailyClosingReport> => {
  const { data } = await api.get("/reports/daily-closing", { params });
  return data;
};

export const sendDailyClosingReport = async (params: {
  date?: string;
  lang?: string;
}): Promise<{ message: string }> => {
  const lang = currentLang(params.lang);
  const { data } = await api.post("/reports/daily-closing/send", { ...params, lang }, {
    headers: { "X-App-Lang": lang },
  });
  return data;
};

export const downloadDailyClosingReportPdf = async (params: {
  date?: string;
  lang?: string;
}): Promise<Blob> => {
  const lang = currentLang(params.lang);
  const { data } = await api.get("/reports/daily-closing/pdf", {
    params: { ...params, lang },
    responseType: "blob",
    headers: { "X-App-Lang": lang },
  });
  return data;
};

export const getStockValuationReport = async (params: {
  preset?: string;
  from?: string;
  to?: string;
  categoryId?: string;
}): Promise<StockValuationResponse> => {
  const { data } = await api.get("/reports/stock-valuation", { params });
  return data;
};
