export type UserRole = "OWNER" | "MANAGER" | "STAFF" | "WAREHOUSE";

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
}

export interface Business {
  id: string;
  name: string;
  currency: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  businesses: Business[];
}
