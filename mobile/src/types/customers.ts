export type CustomerSummary={id:string;name:string;phone:string;address?:string;creditLimit:number;storeCreditBalance:number;isSerialRejecter:boolean;recentReturnCount:number;recentOrderCount:number;orderCount:number;returnCount:number;lastOrderAt:string|null;unpaidBalance:number};
export type CustomerOrder={id:string;orderNo:string;totalAmount:number;createdAt:string;fulfillmentStatus:string};
export type CustomerChip="REPEAT"|"REJECTERS"|"HAS_BAKI"|"HAS_CREDIT";
