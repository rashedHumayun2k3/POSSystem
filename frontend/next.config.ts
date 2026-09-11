import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["recharts"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "fileserverapi.lavlokshan.com" },
    ],
  },
};

// Service worker registration only — offline DATA (the actual sales queue) lives in Dexie
// (posDb.ts), not in the service worker cache. This just makes the app installable and lets the
// already-visited screens (POS, product/price data) open without a network round trip.
//
// Only applied for production builds. @ducanh2912/next-pwa injects a `webpack()` config key
// unconditionally — even with disable:true — and Next.js 16's Turbopack (the default for both
// `next dev` and `next build` now) refuses to run at all if a `webpack` key is present anywhere
// in the config. The service worker is irrelevant in dev anyway, so dev just exports the plain
// config untouched, never triggering the conflict; `npm run build` still passes `--webpack`
// (see package.json) so the production build gets Turbopack's webpack fallback specifically to
// let this plugin run.
const isDev = process.env.NODE_ENV !== "production";

const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  register: true,
  workboxOptions: {
    skipWaiting: true,
  },
});

export default isDev ? nextConfig : withPWA(nextConfig);
