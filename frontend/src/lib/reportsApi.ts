import { api } from "./api";
import type { DashboardKpi, SalesSummary, InventoryReport, PnlReport, OrdersReport, StockValuationResponse } from "@/types/reports";

export const getDashboard = async (): Promise<DashboardKpi> => {
  const { data } = await api.get("/reports/dashboard");
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

export const getStockValuationReport = async (params: {
  preset?: string;
  from?: string;
  to?: string;
  categoryId?: string;
}): Promise<StockValuationResponse> => {
  const { data } = await api.get("/reports/stock-valuation", { params });
  return data;
};
