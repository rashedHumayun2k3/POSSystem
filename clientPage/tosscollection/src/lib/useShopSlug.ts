"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isExportedStorefrontMode, loadExportedStorefrontConfig } from "./storefrontConfig";

const SHOP_PATH_RE = /^\/shop\/([^/]+)/;
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";
const DEFAULT_SHOP_SLUG = process.env.NEXT_PUBLIC_DEFAULT_SHOP_SLUG ?? "";

function resolveHostSlug(hostname: string): string | null {
  if (!BASE_DOMAIN || !hostname.endsWith(`.${BASE_DOMAIN}`)) return null;
  const prefix = hostname.slice(0, -(BASE_DOMAIN.length + 1));
  return prefix && prefix.toLowerCase() !== "www" ? prefix : null;
}

// Mirrors proxy.ts's resolution rules (src/proxy.ts) on the client, reactively — usePathname()/
// useSearchParams() correctly re-run on every navigation, including client-side <Link> clicks,
// unlike a value read once via headers() in the root layout (that layout doesn't re-execute on
// soft navigation, so a prop threaded down from it goes stale the moment you click a shop link
// instead of doing a full page reload — that was the bug).
export function useResolvedShopSlug(): string | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [exportedStoreKey, setExportedStoreKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isExportedStorefrontMode()) return;
    let mounted = true;
    loadExportedStorefrontConfig().then((config) => {
      if (mounted) setExportedStoreKey(config?.storeKey ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (isExportedStorefrontMode()) return exportedStoreKey;

  // Real subdomain always wins, even on the bare root — rahimstore.yourplatform.com/ is always
  // rahimstore's home, no ambiguity to "escape" the way there is on the shared main domain.
  const hostSlug = typeof window !== "undefined" ? resolveHostSlug(window.location.hostname) : null;
  if (hostSlug) return hostSlug;

  const pathMatch = pathname.match(SHOP_PATH_RE);
  if (pathMatch) return pathMatch[1];

  const queryShop = searchParams.get("shop");
  if (queryShop) return queryShop;

  if (DEFAULT_SHOP_SLUG) return DEFAULT_SHOP_SLUG;

  // Bare root is the one deliberate reset point (see proxy.ts) — never falls back to a leftover
  // shop cookie, so Home always means "back to the marketplace" on the shared main domain.
  if (pathname === "/") return null;

  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)cp_shop=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}
