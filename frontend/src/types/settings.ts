export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: "OWNER" | "MANAGER" | "PARTNER" | "STAFF" | "WAREHOUSE";
  monthlySalary: number;
  isActive: boolean;
}

export interface Courier {
  id: string;
  name: string;
  phone?: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  returnCharge: number;
  codFeeType: "FLAT" | "PCT";
  codFeeValue: number;
  isDefault: boolean;
  trackingUrlTemplate?: string;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isSystem: boolean;
  isDefault: boolean;
}

export interface AppSettings {
  target_margin_pct?: string;
  overhead_mode?: string;
  refund_threshold?: string;
  low_stock_default?: string;
  return_policy_days?: string;
  selling_mode?: string; // RETAIL | WHOLESALE | BOTH — controls product form wholesale section
}
