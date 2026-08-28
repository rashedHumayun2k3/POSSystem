import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Inter_Tight, Manrope } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const zenDots = localFont({
  src: "./fonts/ZenDots-Regular.ttf",
  variable: "--font-zen-dots",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Online Storefront",
  description: "Shop products online",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${manrope.variable} ${zenDots.variable} h-full antialiased`}>
      <body className="min-h-full bg-white" suppressHydrationWarning>
        <div className="storefront-shell min-h-full bg-white">
          <Providers>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
