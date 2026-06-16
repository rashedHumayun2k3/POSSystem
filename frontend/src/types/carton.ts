export type CartonStatus = 'SEALED' | 'OPENED' | 'PARTIAL' | 'DONE';

export interface CartonSummary {
  id: string;
  cartonNo: string;
  tripId: string;
  tripNo: string;
  status: CartonStatus;
  location: string | null;
  notes: string | null;
  createdAt: string;
  openedAt: string | null;
  itemCount: number;
  totalQtyInCarton: number;
  totalLabeled: number;
  totalDamaged: number;
}

export interface CartonItem {
  id: string;
  variantId: string;
  variantSku: string;
  productName: string;
  variantValues: string;
  barcode: string | null;
  qtyInCarton: number;
  qtyLabeled: number;
  qtyDamaged: number;
  labelPrice: number;
  qtyRemaining: number;
}

export interface CartonDetail extends CartonSummary {
  items: CartonItem[];
}

export interface StoreroomSummary {
  totalCartons: number;
  sealed: number;
  opened: number;
  partial: number;
  done: number;
  totalUnitsInCartons: number;
  totalLabeled: number;
  totalDamaged: number;
}

export interface LocationLookupItem {
  cartonId: string;
  cartonNo: string;
  tripId: string;
  tripNo: string;
  location: string | null;
  status: CartonStatus;
  qtyInCarton: number;
  qtyLabeled: number;
  qtyDamaged: number;
}

export interface DamagedItem {
  cartonId: string;
  cartonNo: string;
  tripId: string;
  tripNo: string;
  openedAt: string | null;
  variantId: string;
  productName: string;
  variantSku: string;
  variantValues: string;
  qtyDamaged: number;
}

export interface TripWithCartons {
  tripId: string;
  tripNo: string;
  tripStatus: string;
  createdAt: string;
  cartonCount: number;
  sealedCount: number;
  doneCount: number;
}
