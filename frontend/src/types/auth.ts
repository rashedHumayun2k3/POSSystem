export type UserRole = "OWNER" | "MANAGER" | "STAFF" | "WAREHOUSE";

export type BusinessType =
  | "CLOTHING_FASHION"
  | "COSMETICS_BEAUTY"
  | "ELECTRONICS_GADGETS"
  | "SHOES_FOOTWEAR"
  | "BAGS_ACCESSORIES"
  | "TOYS_BABY"
  | "HOME_KITCHEN"
  | "BOOKS_STATIONERY"
  | "OTHER";

// How the business sells — distinct from BusinessType (which is industry/product category).
export type SalesChannel = "POS" | "HAWKER" | "ONLINE";

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  photoUrl?: string | null;
}

export interface Business {
  id: string;
  name: string;
  currency: string;
  country?: string | null;
  businessTypes?: BusinessType[];
  salesChannels?: SalesChannel[];
  onboardingCompleted?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  businesses: Business[];
}

export interface RequestSignupCodeRequest {
  email: string;
}

export interface VerifySignupCodeRequest {
  email: string;
  code: string;
}

export interface VerifySignupCodeResponse {
  verified: boolean;
}

export interface SignUpCompleteRequest {
  email: string;
  name: string;
  phone: string;
  password: string;
  businessName: string;
  country?: string;
}

export interface SetBusinessTypesRequest {
  businessTypes: BusinessType[];
}

export interface SetSalesChannelsRequest {
  salesChannels: SalesChannel[];
}
