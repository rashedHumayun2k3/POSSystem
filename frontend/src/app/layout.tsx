import type { Metadata, Viewport } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import GlobalToast from "@/components/layout/GlobalToast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind-siliguri",
});

export const metadata: Metadata = {
  title: "LavLokshan",
  description: "Business management for resellers",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LavLokshan" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning className={`${inter.variable} ${hindSiliguri.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <GlobalToast />
      </body>
    </html>
  );
}
