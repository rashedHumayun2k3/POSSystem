export type StockValuationPreset="this_month"|"last_month"|"last_3_months"|"this_year"|"custom";
export type SortMode="stockValue"|"profit"|"slowMovers";
export type StockValuationProduct={productId:string;productName:string;categoryId:string;categoryName:string;avgBuyPrice:number;onHandQty:number;stockValue:number;potentialProfit:number;qtySold:number;revenue:number;realizedProfit:number;avgActualSellPrice:number;soldPerMonth:number|null;monthsOfStockLeft:number|null;totalBoughtQty:number};
export type StockValuationCategory={categoryId:string;categoryName:string;stockValue:number;realizedProfit:number;products:StockValuationProduct[]};
export type StockValuationResponse={grandStockValue:number;grandPotentialProfit:number;grandRealizedProfit:number;grandRevenue:number;rangeFromDate:string;rangeToDate:string;rangeLabel:string;showVelocity:boolean;categories:StockValuationCategory[]};
export type ValuationCategoryOption={id:string;name:string};
