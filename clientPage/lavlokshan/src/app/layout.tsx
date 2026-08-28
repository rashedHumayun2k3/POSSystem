import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Online Storefront",
  description: "Shop products online",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans" suppressHydrationWarning>
        {/* Phone-card look (narrow width + shadow) below lg; a normal wide site above it —
            same page, same components, just reshaped by breakpoint (see layout discussion). */}
        <div className="storefront-shell max-w-[768px] lg:max-w-[1280px] mx-auto min-h-full bg-white shadow-sm lg:shadow-none">
          <Providers>
            <div className="pb-16 lg:pb-0">{children}</div>
            <BottomNav />
          </Providers>
        </div>
      </body>
    </html>
  );
}
