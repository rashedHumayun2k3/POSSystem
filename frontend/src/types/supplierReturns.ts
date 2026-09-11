export type SupplierReturnStatus = 'DRAFT' | 'SUBMITTED' | 'RESOLVED' | 'CANCELLED';
export type ResolutionType = 'REFUND' | 'REPLACEMENT' | 'CREDIT_NOTE' | 'WRITE_OFF';

export interface SupplierReturnListItem {
  id: string;
  supplierReturnNo: string;
  supplierId: string;
  supplierName: string;
  tripId: string | null;
  tripNo: string | null;
  status: SupplierReturnStatus;
  itemCount: number;
  totalQty: number;
  totalValue: number;
  createdAt: string;
}

export interface SupplierReturnItemDto {
  id: string;
  variantId: string;
  variantSku: string;
  productName: string;
  unitCode: string;
  qtyReturned: number;
  unitCost: number;
  resolutionType: ResolutionType;
  resolutionAmount: number | null;
  replacementTripId: string | null;
  replacementTripNo: string | null;
  note: string | null;
}

export interface SupplierReturnDetail {
  id: string;
  supplierReturnNo: string;
  branchId: string | null;
  supplierId: string;
  supplierName: string;
  supplierAddress: string | null;
  tripId: string | null;
  tripNo: string | null;
  status: SupplierReturnStatus;
  note: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  items: SupplierReturnItemDto[];
}

export interface DamagedStockItem {
  variantId: string;
  variantSku: string;
  productName: string;
  unitCode: string;
  damagedQty: number;
  avgLandedCost: number;
}

export interface SupplierReturnItemPayload {
  variantId: string;
  qtyReturned: number;
  unitCost: number;
  resolutionType: ResolutionType;
  resolutionAmount?: number;
  replacementTripId?: string;
  note?: string;
}
