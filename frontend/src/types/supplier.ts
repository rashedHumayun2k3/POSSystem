export interface SupplierDto {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  usageCount: number;
  lastUsedAt: string | null;
}

export interface CreateSupplierPayload {
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateSupplierPayload {
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
}
