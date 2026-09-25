export type ReportPeriod="today"|"7d"|"30d"|"3m"|"6m";
export type GroupBy="day"|"week"|"month";
export type DatePoint={label:string;value:number};
export type NameValue={name:string;value:number};
export type SalesSummary={totalRevenue:number;totalOrders:number;totalDiscount:number;averageOrderValue:number;revenueByPeriod:DatePoint[];topProducts:NameValue[];byCategory:NameValue[];byCashier:NameValue[];byPaymentMethod:NameValue[];hourlySales:DatePoint[]};
