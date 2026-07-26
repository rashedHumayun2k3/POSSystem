export type SourceType = 'CHINA_TRIP' | 'ALIBABA' | 'LOCAL_WHOLESALE' | 'AGENT';
export type TripStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'RECEIVING' | 'COMPLETED' | 'CANCELLED';
export type CostType = 'TRANSPORT' | 'LABOR' | 'CUSTOMS' | 'SHIPPING_INTL' | 'CURRENCY_LOSS' | 'AGENT_FEE' | 'PAYMENT_FEE' | 'OTHER';
export type SessionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type TransportMode = 'TRUCK' | 'BUS' | 'AIR' | 'COURIER' | 'BOAT' | 'WALK_IN' | 'OTHER';

export interface PurchaseTripSummary {
  id: string;
  tripNo: string;
  sourceType: SourceType;
  status: TripStatus;
  itemCount: number;
  totalQtyBought: number;
  totalQtyUsable: number;
  totalQtyDamaged: number;
  totalItemCost: number;
  totalSharedCost: number;
  createdAt: string;
}

export interface PurchaseItemDto {
  id: string;
  variantId: string;
  variantSku: string;
  productName: string;
  unitCode: string;
  qtyBought: number;
  qtyUsable: number;
  qtyDamaged: number;
  totalCost: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  memoPhotoUrl: string | null;
  paidNow: number;
  dueAmount: number;
  promisedDate: string | null;
  allocatedSharedCost: number;
  landedUnitCost: number;
}

export interface PurchaseTripCostDto {
  id: string;
  costType: CostType;
  amount: number;
  note: string | null;
  photoUrl: string | null;
  paidBy: string | null;
  isPostCompletion: boolean;
}

export interface PurchaseReceiveItemDto {
  id: string;
  purchaseItemId: string;
  qtyUsable: number;
  qtyDamaged: number;
  perLotValuesJson: string | null;
}

export interface PurchaseReceiveSessionDto {
  id: string;
  sessionNo: string;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  transportMode: TransportMode;
  vehicleOrTrackingNo: string | null;
  note: string | null;
  status: SessionStatus;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  items: PurchaseReceiveItemDto[];
}

export interface PurchaseTripDetail {
  id: string;
  tripNo: string;
  sourceType: SourceType;
  status: TripStatus;
  note: string | null;
  expectedDeliveryDate: string | null;
  supplierPoRef: string | null;
  createdAt: string;
  completedAt: string | null;
  forceCloseReason: string | null;
  items: PurchaseItemDto[];
  costs: PurchaseTripCostDto[];
  sessions: PurchaseReceiveSessionDto[];
}

export interface UnaccountedUnitItem {
  variantSku: string;
  productName: string;
  qtyBought: number;
  qtyEntered: number;
  qtyUnaccounted: number;
}

export interface ForceCloseRequired {
  requiresForceClose: true;
  message: string;
  items: UnaccountedUnitItem[];
}

export interface AddItemPayload {
  variantId: string;
  qtyBought: number;
  totalCost: number;
  supplierId?: string;
  memoPhotoUrl?: string;
  paidNow: number;
  dueAmount: number;
  promisedDate?: string;
}

export interface UpdateItemPayload {
  qtyBought: number;
  totalCost: number;
  supplierId?: string;
  memoPhotoUrl?: string;
  paidNow: number;
  dueAmount: number;
  promisedDate?: string;
}

export interface AddCostPayload {
  costType: CostType;
  amount: number;
  note?: string;
  photoUrl?: string;
  paidBy?: string;
}

export interface SessionItemInput {
  purchaseItemId: string;
  qtyUsable: number;
  qtyDamaged: number;
  perLotValuesJson: string;
}

export interface CreateReceiveSessionPayload {
  receivedAt: string;
  transportMode: TransportMode;
  vehicleOrTrackingNo?: string;
  note?: string;
  items: SessionItemInput[];
}

export interface LandedCostPreview {
  purchaseItemId: string;
  productName: string;
  variantSku: string;
  qtyUsable: number;
  totalCost: number;
  allocatedSharedCost: number;
  landedUnitCost: number;
  currentAvgCost: number;
  newAvgCost: number;
}

export interface SessionPreview {
  totalSharedCost: number;
  items: LandedCostPreview[];
}
