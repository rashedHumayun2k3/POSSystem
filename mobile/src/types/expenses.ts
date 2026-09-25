export type ExpenseStatus="PENDING"|"APPROVED"|"REJECTED";
export type Expense={id:string;categoryId:string;categoryName:string;subType:string;amount:number;expenseDate:string;staffId:string|null;staffName:string|null;isRecurring:boolean;recurringDay:number|null;allocateToTripId:string|null;pettyCashBoxId:string|null;photoUrl:string|null;status:ExpenseStatus;paidAt:string|null;createdBy:string;createdByName:string;approvedBy:string|null;approvedByName:string|null;note:string|null;rejectionReason:string|null;createdAt:string};
export type ExpenseCategory={id:string;code:string;name:string;isSystem:boolean;isDefault:boolean;isActive:boolean};
export type ExpensePage={items:Expense[];total:number;page:number;pageSize:number};
