import { api } from "./api";

export interface StorefrontSettings {
  showOnMarketplace: boolean;
  subdomain: string | null;
  storefrontEnabled: boolean;
  logoUrl: string | null;
}

export const getStorefrontSettings = async (): Promise<StorefrontSettings> => {
  const { data } = await api.get("/businesses/storefront-settings");
  return data;
};

export const updateStorefrontSettings = async (showOnMarketplace: boolean): Promise<{ showOnMarketplace: boolean }> => {
  const { data } = await api.patch("/businesses/storefront-settings", { showOnMarketplace });
  return data;
};

export const setSubdomain = async (subdomain: string): Promise<{ subdomain: string; storefrontEnabled: boolean }> => {
  const { data } = await api.put("/businesses/subdomain", { subdomain });
  return data;
};

export const setStorefrontEnabled = async (enabled: boolean): Promise<{ storefrontEnabled: boolean }> => {
  const { data } = await api.patch("/businesses/storefront-enabled", { enabled });
  return data;
};

// Also used as the logo on the A4 online-order invoice — not just storefront branding.
export const updateBusinessLogo = async (logoUrl: string | null): Promise<{ logoUrl: string | null }> => {
  const { data } = await api.patch("/businesses/logo", { logoUrl });
  return data;
};
