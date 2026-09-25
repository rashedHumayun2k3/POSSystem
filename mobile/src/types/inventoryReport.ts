export type InventoryTab="status"|"low"|"movements"|"fast"|"slow";
export type ReportPeriod="today"|"7d"|"30d"|"3m"|"6m";
export type GroupBy="day"|"week"|"month";
export type DatePoint={label:string;value:number};
export type NameValue={name:string;value:number};
export type StockStatusItem={variantSku:string;productName:string;variantLabel?:string;barcode?:string|null;imageUrl?:string|null;onHand:number;allocated:number;available:number;damaged:number;reorderLevel:number;isLowStock:boolean;isOutOfStock:boolean};
export type InventoryReport={totalVariants:number;lowStockCount:number;outOfStockCount:number;totalInventoryValue:number;items:StockStatusItem[];movementTrend:DatePoint[];fastMovingProducts:NameValue[];slowMovingProducts:NameValue[]};
