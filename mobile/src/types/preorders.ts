export type PreOrderStatus = "CONFIRMED" | "WAITING_STOCK" | "COMPLETED" | "CANCELLED";
export type PreOrderItem = { id:string; productId:string; variantId:string; productName:string; variantName:string; quantityRequested:number; quantityReserved:number; quantityWaiting:number; quantityFulfilled:number; unitPriceSnapshot:number };
export type PreOrder = { id:string; preOrderNo:string; source:string; status:PreOrderStatus; customerName?:string|null; customerPhone?:string|null; customerReference?:string|null; requestedAt:string; cancellationReason?:string|null; items:PreOrderItem[] };
