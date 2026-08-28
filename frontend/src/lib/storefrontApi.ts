import { api } from "./api";

export interface StorefrontSettings {
  showOnMarketplace: boolean;
  subdomain: string | null;
  storefrontEnabled: boolean;
  logoUrl: string | null;
  bannerUrl: string | null;
  externalWebsiteUrl: string | null;
  storefrontThemeId: string;
  websiteSettings: StorefrontWebsiteSettings | null;
}

export interface StorefrontWebsiteSettings {
  faviconUrl?: string | null;
  sliderImageUrls?: string[] | null;
  aboutText?: string | null;
  contactPhone?: string | null;
  whatsappNumber?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  deliveryPolicy?: string | null;
  returnPolicy?: string | null;
  privacyPolicy?: string | null;
  termsPolicy?: string | null;
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

export const updateBusinessBanner = async (bannerUrl: string | null): Promise<{ bannerUrl: string | null }> => {
  const { data } = await api.patch("/businesses/banner", { bannerUrl });
  return data;
};

export const updateWebsiteSettings = async (
  websiteSettings: StorefrontWebsiteSettings,
): Promise<{ websiteSettings: StorefrontWebsiteSettings }> => {
  const { data } = await api.patch("/businesses/website-settings", websiteSettings);
  return data;
};

export const updateWebsite = async (websiteUrl: string | null): Promise<{ externalWebsiteUrl: string | null }> => {
  const { data } = await api.patch("/businesses/website", { websiteUrl });
  return data;
};

export const updateStorefrontTheme = async (themeId: string): Promise<{ storefrontThemeId: string }> => {
  const { data } = await api.patch("/businesses/storefront-theme", { themeId });
  return data;
};

export const downloadStorefrontWebsite = async (): Promise<{ blob: Blob; fileName: string }> => {
  const response = await api.post("/website/download", null, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] as string | undefined;
  const fileName = disposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1];

  return {
    blob: response.data,
    fileName: fileName ? decodeURIComponent(fileName.replace(/"/g, "")) : "storefront-website.zip",
  };
};
