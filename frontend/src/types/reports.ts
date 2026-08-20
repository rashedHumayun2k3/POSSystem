export interface DatePoint {
  label: string;
  value: number;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface ExpenseCategoryBreakdown {
  code: string;
  name: string;
  value: number;
  subtypes: NameValue[];
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

export interface HomeSummary {
  todaySales: number;
  yesterdaySales: number;
  salesChangePercent: number | null;
  todayProfit: number | null;
  todayMarginPercent: number | null;
  todayOrders: number;
  pendingOrders: number;
  pendingDeliveries: number;
  todayReturns: number;
  lowStockCount: number;
  outOfStockCount: number;
  customerReceivable: number;
  customersWithDue: number;
  moneyAtCourier: number;
  todayCash: number;
  supplierPayable: number | null;
  suppliersWithDue: number | null;
  sevenDaySales: DatePoint[];
  topProductsToday: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
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
  barcode?: string | null;
  imageUrl?: string | null;
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
  expenseByCategory: ExpenseCategoryBreakdown[];
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

export interface DailyClosingStatusCount {
  status: string;
  count: number;
}

export interface DailyClosingSoldProduct {
  productName: string;
  variantLabel?: string | null;
  sku: string;
  qty: number;
  revenue: number;
  profit: number;
}

export interface DailyClosingLowStock {
  productName: string;
  variantLabel?: string | null;
  sku: string;
  quantity: number;
  reorderLevel: number;
}

export interface DailyClosingPurchaseItem {
  productName: string;
  variantLabel?: string | null;
  sku: string;
  qty: number;
  totalCost: number;
}

export interface DailyClosingOrderItem {
  orderNo: string;
  customerName: string;
  amount: number;
  status: string;
  note?: string | null;
}

export interface DailyClosingExpense {
  type: string;
  amount: number;
}

export interface DailyClosingCustomerInsight {
  newCustomersToday: number;
  returningCustomers: number;
  highestSpendingCustomerName?: string | null;
  highestSpendingCustomerAmount: number;
  customerComplaints: number;
}

export interface DailyClosingHealth {
  label: string;
  status: string;
  tone: string;
}

export interface DailyClosingReport {
  date: string;
  dayName: string;
  businessName: string;
  branchName: string;
  isAllBranches: boolean;
  totalSales: number;
  netSales: number;
  totalProfit: number;
  netProfit: number;
  totalDue: number;
  totalPaid: number;
  totalDiscount: number;
  totalExpenses: number;
  averageOrderValue: number;
  dueCollection: number;
  newDueCreated: number;
  totalOutstandingDue: number;
  ordersReceived: number;
  ordersDelivered: number;
  ordersPending: number;
  ordersReturned: number;
  ordersCancelled: number;
  purchaseTotal: number;
  purchaseQty: number;
  topSellingProduct?: string | null;
  orderStatuses: DailyClosingStatusCount[];
  paymentMethods: NameValue[];
  soldProducts: DailyClosingSoldProduct[];
  lowStockProducts: DailyClosingLowStock[];
  purchaseItems: DailyClosingPurchaseItem[];
  newOrders: DailyClosingOrderItem[];
  deliveredOrders: DailyClosingOrderItem[];
  returnedOrders: DailyClosingOrderItem[];
  pendingOrders: DailyClosingOrderItem[];
  expenses: DailyClosingExpense[];
  customerInsights: DailyClosingCustomerInsight;
  tomorrowActionItems: string[];
  ownerDashboard: DailyClosingHealth[];
}

export type ReportPeriod = 'today' | '7d' | '30d' | '3m' | '6m';
export type GroupBy = 'day' | 'week' | 'month';

// ── Stock Valuation ───────────────────────────────────────────────────────────
//
// Time semantics: stock-side fields (avgBuyPrice, onHandQty, stockValue, potentialProfit,
// totalBoughtQty) are always "as of now" — the date range never applies to them. Sales-side
// fields (qtySold, revenue, realizedProfit, avgActualSellPrice, soldPerMonth,
// monthsOfStockLeft) ARE filtered by the selected range.

export type StockValuationPreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

export interface StockValuationProduct {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  avgBuyPrice: number;
  onHandQty: number;
  stockValue: number;
  potentialProfit: number;
  qtySold: number;
  revenue: number;
  realizedProfit: number;
  avgActualSellPrice: number;
  soldPerMonth: number | null;
  monthsOfStockLeft: number | null;
  totalBoughtQty: number;
}

export interface StockValuationCategory {
  categoryId: string;
  categoryName: string;
  stockValue: number;
  realizedProfit: number;
  products: StockValuationProduct[];
}

export interface StockValuationResponse {
  grandStockValue: number;
  grandPotentialProfit: number;
  grandRealizedProfit: number;
  grandRevenue: number;
  rangeFromDate: string;
  rangeToDate: string;
  rangeLabel: string;
  showVelocity: boolean;
  categories: StockValuationCategory[];
}
