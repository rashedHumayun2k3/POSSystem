import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_PUBLIC_STOREFRONT_EXPORT === "true" ? "export" : undefined,
  trailingSlash: process.env.NEXT_PUBLIC_STOREFRONT_EXPORT === "true",
  images: {
    unoptimized: process.env.NEXT_PUBLIC_STOREFRONT_EXPORT === "true",
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
