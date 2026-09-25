export type ReportPeriod="today"|"7d"|"30d"|"3m"|"6m";
export type GroupBy="day"|"week"|"month";
export type DatePoint={label:string;value:number};
export type NameValue={name:string;value:number};
export type ExpenseCategory={code:string;name:string;value:number;subtypes:NameValue[]};
export type FinancialReport={revenue:number;cogs:number;grossProfit:number;grossMarginPct:number;totalExpenses:number;netProfit:number;netMarginPct:number;totalDiscount:number;revenueTrend:DatePoint[];profitTrend:DatePoint[];expenseTrend:DatePoint[];expenseByCategory:ExpenseCategory[]};
