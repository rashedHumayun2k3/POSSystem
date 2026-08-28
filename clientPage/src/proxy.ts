import { NextRequest, NextResponse } from "next/server";

// Resolves which shop this request is for, from — in priority order — the real Host header
// (production, once a shop has a real subdomain), a `/shop/{slug}` URL prefix, a `?shop=` query
// param, or a previously-set cookie (so context persists across normal navigation after any of
// the above). See docs/clientpage-storefront-requirements.md §2 for why the backend can't
// reliably see the browser's Host itself and the frontend has to resolve + forward it.
//
// `/shop/{slug}` is the always-works, zero-infra sharing URL (yourplatform.com/shop/rahimstore)
// — a shop owner can share this today without any DNS/SSL setup. It's implemented as a rewrite:
// the address bar keeps showing `/shop/rahimstore/...`, but internally the request is served by
// the normal (unprefixed) route for whatever follows, exactly like every other page already
// works once shop context is set. Subdomains remain a drop-in upgrade for later — same
// resolution mechanism, just fed from the Host header instead of the path once wildcard DNS
// exists.
//
// Named `proxy.ts` (not `middleware.ts`) — Next.js 16 renamed Middleware to Proxy.
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";
const SHOP_COOKIE = "cp_shop";
const SHOP_PATH_RE = /^\/shop\/([^/]+)(\/.*)?$/;

function resolveHostSlug(host: string): string | null {
  if (!BASE_DOMAIN || !host.endsWith(`.${BASE_DOMAIN}`)) return null;
  const prefix = host.slice(0, -(BASE_DOMAIN.length + 1));
  return prefix && prefix.toLowerCase() !== "www" ? prefix : null;
}

export function proxy(request: NextRequest) {
  const hostSlug = resolveHostSlug(request.headers.get("host") ?? "");
  const shopParam = request.nextUrl.searchParams.get("shop");
  const pathMatch = request.nextUrl.pathname.match(SHOP_PATH_RE);
  const pathSlug = pathMatch?.[1] ?? null;
  const isBareRoot = request.nextUrl.pathname === "/";

  // An explicit assertion of "this is the shop I want" — real subdomain, path prefix, or query
  // param — always wins and refreshes the cookie. Sub-pages (category/product/search) fall back
  // to the cookie so shop context survives normal browsing after any of those. The bare root path
  // ("/") is the one deliberate exception when NONE of those explicit signals are present: it's
  // the platform's actual home, and a plain visit there (the Home tab, the logo, typing the
  // domain directly) has to be able to escape a shop and reach the marketplace — otherwise, once
  // you've ever visited a shop, "/" is stuck showing it forever until the cookie expires. This
  // never suppresses a real subdomain, though — rahimstore.yourplatform.com/ always means
  // rahimstore's home, full stop, since there's no ambiguity to escape on an actual subdomain.
  const explicitSlug = hostSlug ?? pathSlug ?? shopParam;

  let response: NextResponse;
  if (pathMatch) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = pathMatch[2] || "/";
    response = NextResponse.rewrite(rewrittenUrl);
  } else {
    response = NextResponse.next();
  }

  if (explicitSlug) {
    response.cookies.set(SHOP_COOKIE, explicitSlug, { path: "/", maxAge: 60 * 60 * 24 });
  } else if (isBareRoot) {
    response.cookies.delete(SHOP_COOKIE);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
