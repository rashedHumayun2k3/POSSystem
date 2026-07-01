export interface DatePoint {
  label: string;
  value: number;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface DashboardKpi {
  todaySales: number;
  todayOrders: number;
  todayProfit: number;
  todayCustomers: number;
  todayProductsSold: number;
  todayReturns: number;
  lowStockCount: number;
  outOfStockCount: number;
  salesTrend: DatePoint[];
  topProducts: NameValue[];
  paymentMethods: NameValue[];
  hourlySales: DatePoint[];
  salesByCategory: NameValue[];
}

export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  totalDiscount: number;
  averageOrderValue: number;
  revenueByPeriod: DatePoint[];
  topProducts: NameValue[];
  byCategory: NameValue[];
  byCashier: NameValue[];
  byPaymentMethod: NameValue[];
  hourlySales: DatePoint[];
}

export interface StockStatusItem {
  variantSku: string;
  productName: string;
  variantLabel?: string;
  onHand: number;
  allocated: number;
  available: number;
  damaged: number;
  reorderLevel: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export interface InventoryReport {
  totalVariants: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: number;
  items: StockStatusItem[];
  movementTrend: DatePoint[];
  fastMovingProducts: NameValue[];
  slowMovingProducts: NameValue[];
}

export interface PnlReport {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPct: number;
  totalDiscount: number;
  revenueTrend: DatePoint[];
  profitTrend: DatePoint[];
  expenseTrend: DatePoint[];
  expenseByCategory: NameValue[];
}

export interface OrdersReport {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  returnRate: number;
  ordersTrend: DatePoint[];
  cancelledTrend: DatePoint[];
  returnReasons: NameValue[];
  ordersByChannel: NameValue[];
}

export type ReportPeriod = 'today' | '7d' | '30d' | '3m';
export type GroupBy = 'day' | 'week' | 'month';
