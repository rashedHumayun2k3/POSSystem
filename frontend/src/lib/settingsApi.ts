import { api } from "./api";
import type { StaffUser, Courier, ExpenseCategory, AppSettings } from "@/types/settings";

// ── Staff ──────────────────────────────────────────────────────────────────
export const getStaff = (): Promise<StaffUser[]> =>
  api.get("/users").then((r) => r.data);

export const createStaff = (data: {
  name: string; phone: string; password: string; role: string; monthlySalary: number;
}): Promise<StaffUser> =>
  api.post("/users", data).then((r) => r.data);

export const updateStaff = (id: string, data: {
  name: string; role: string; monthlySalary: number;
}): Promise<void> =>
  api.patch(`/users/${id}`, data);

export const deactivateStaff = (id: string): Promise<void> =>
  api.patch(`/users/${id}/deactivate`);

export const resetStaffPassword = (id: string, newPassword: string): Promise<void> =>
  api.patch(`/users/${id}/reset-password`, { newPassword });

// ── Couriers ───────────────────────────────────────────────────────────────
export const getCouriers = (): Promise<Courier[]> =>
  api.get("/couriers").then((r) => r.data);

export interface CourierPayload {
  name: string;
  phone?: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  returnCharge: number;
  codFeeType: "FLAT" | "PCT";
  codFeeValue: number;
  isDefault: boolean;
  trackingUrlTemplate?: string;
}

export const createCourier = (data: CourierPayload): Promise<Courier> =>
  api.post("/couriers", data).then((r) => r.data);

export const updateCourier = (id: string, data: CourierPayload): Promise<void> =>
  api.patch(`/couriers/${id}`, data);

export const toggleCourierActive = (id: string): Promise<{ isActive: boolean }> =>
  api.patch(`/couriers/${id}/toggle-active`).then((r) => r.data);

export const deleteCourier = (id: string): Promise<void> =>
  api.delete(`/couriers/${id}`);

// ── Expense Categories ─────────────────────────────────────────────────────
export const getExpenseCategories = (): Promise<ExpenseCategory[]> =>
  api.get("/expense-categories").then((r) => r.data);

export const createExpenseCategory = (data: {
  name: string; isDefault: boolean;
}): Promise<ExpenseCategory> =>
  api.post("/expense-categories", data).then((r) => r.data);

export const updateExpenseCategory = (id: string, data: {
  name: string; isDefault: boolean;
}): Promise<void> =>
  api.patch(`/expense-categories/${id}`, data);

export const deleteExpenseCategory = (id: string): Promise<void> =>
  api.delete(`/expense-categories/${id}`);

// ── App Settings ───────────────────────────────────────────────────────────
export const getAppSettings = (): Promise<AppSettings> =>
  api.get("/settings").then((r) => r.data);

export const upsertSetting = (key: string, value: string): Promise<void> =>
  api.put("/settings", { key, value });
