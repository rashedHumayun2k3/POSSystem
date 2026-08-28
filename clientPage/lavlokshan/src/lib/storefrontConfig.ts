"use client";

export interface ExportedStorefrontConfig {
  storeKey: string;
  apiBaseUrl: string;
  mediaBaseUrl?: string;
  themeId?: string;
  storefrontVersion?: string;
}

let configPromise: Promise<ExportedStorefrontConfig | null> | null = null;

export function isExportedStorefrontMode() {
  return process.env.NEXT_PUBLIC_STOREFRONT_EXPORT === "true";
}

export function loadExportedStorefrontConfig(): Promise<ExportedStorefrontConfig | null> {
  if (!isExportedStorefrontMode() || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!configPromise) {
    configPromise = fetch("/store-config.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Storefront configuration could not be loaded.");
        }

        const config = (await response.json()) as ExportedStorefrontConfig;
        if (!config.storeKey || !config.apiBaseUrl) {
          throw new Error("Storefront configuration is incomplete.");
        }

        return config;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
  }

  return configPromise;
}
