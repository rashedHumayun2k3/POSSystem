export interface ExpenseCategoryDto {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  isDefault: boolean;
  isActive: boolean;
}

export interface ExpenseDto {
  id: string;
  categoryId: string;
  categoryName: string;
  subType: string;
  amount: number;
  expenseDate: string;       // ISO date string
  staffId: string | null;
  staffName: string | null;
  isRecurring: boolean;
  recurringDay: number | null;
  allocateToTripId: string | null;
  pettyCashBoxId: string | null;
  photoUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  paidAt: string | null;
  createdBy: string;
  createdByName: string;
  approvedBy: string | null;
  approvedByName: string | null;
  note: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface CreateExpensePayload {
  categoryId: string;
  subType: string;
  amount: number;
  expenseDate: string;
  staffId?: string | null;
  isRecurring: boolean;
  recurringDay?: number | null;
  allocateToTripId?: string | null;
  pettyCashBoxId?: string | null;
  photoUrl?: string | null;
  note?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PettyCashBoxDto {
  id: string;
  staffId: string;
  staffName: string;
  balance: number;
  createdAt: string;
}

export interface PettyCashTxnDto {
  id: string;
  txnType: 'FUND_IN' | 'SPEND' | 'ADJUST';
  amount: number;
  expenseId: string | null;
  expenseSubType: string | null;
  userId: string;
  userName: string;
  note: string | null;
  createdAt: string;
}
