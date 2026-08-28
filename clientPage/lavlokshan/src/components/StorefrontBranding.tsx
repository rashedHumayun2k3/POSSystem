"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useShopContext } from "@/context/ShopContext";
import { resolveMediaUrl } from "@/lib/media";
import { isExportedStorefrontMode, loadExportedStorefrontConfig } from "@/lib/storefrontConfig";
import { getStorefrontThemePreset } from "@/lib/storefrontThemes";

function createInitialFavicon(shopName: string) {
  const firstCharacter = Array.from(shopName.trim())[0]?.toUpperCase();
  const initial = firstCharacter && /[\p{L}\p{N}]/u.test(firstCharacter) ? firstCharacter : "S";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#4f46e5"/><text x="32" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="white">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function StorefrontBranding() {
  const pathname = usePathname();
  const { mode, shopName, logoUrl, isLoading } = useShopContext();

  useEffect(() => {
    if (isLoading || mode !== "shop" || !shopName) return;

    document.title = shopName;

    const faviconUrl = resolveMediaUrl(logoUrl) ?? createInitialFavicon(shopName);
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((link) => link.remove());

    const favicon = document.createElement("link");
    favicon.id = "storefront-favicon";
    favicon.rel = "icon";
    favicon.href = faviconUrl;
    document.head.appendChild(favicon);
  }, [isLoading, logoUrl, mode, pathname, shopName]);

  useEffect(() => {
    if (!isExportedStorefrontMode()) return;

    loadExportedStorefrontConfig().then((config) => {
      const theme = getStorefrontThemePreset(config?.themeId);
      const root = document.documentElement;
      root.style.setProperty("--storefront-bg", theme.background);
      root.style.setProperty("--storefront-surface", theme.surface);
      root.style.setProperty("--storefront-header", theme.header);
      root.style.setProperty("--storefront-header-muted", theme.headerMuted);
      root.style.setProperty("--storefront-text", theme.text);
      root.style.setProperty("--storefront-muted-text", theme.mutedText);
      root.style.setProperty("--storefront-accent", theme.accent);
      root.style.setProperty("--storefront-accent-text", theme.accentText);
      document.body.dataset.storefrontTheme = theme.id;
    });
  }, []);

  return null;
}
