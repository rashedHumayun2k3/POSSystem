export type ReportPeriod="today"|"7d"|"30d"|"3m"|"6m";
export type GroupBy="day"|"week"|"month";
export type DatePoint={label:string;value:number};
export type NameValue={name:string;value:number};
export type OrdersReport={totalOrders:number;completedOrders:number;pendingOrders:number;cancelledOrders:number;returnedOrders:number;returnRate:number;ordersTrend:DatePoint[];cancelledTrend:DatePoint[];returnReasons:NameValue[];ordersByChannel:NameValue[]};
