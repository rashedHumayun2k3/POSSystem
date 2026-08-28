"use client";

import Link from "next/link";
import { useShopContext } from "@/context/ShopContext";

export default function Footer() {
  const { mode, shopName, websiteSettings } = useShopContext();

  return (
    <footer className="bg-white border-t border-gray-100 px-4 py-6 mt-2 text-center space-y-3">
      {mode === "shop" && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/delivery-policy">Delivery Policy</Link>
          <Link href="/return-policy">Return Policy</Link>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      )}
      {mode === "shop" && (websiteSettings?.contactPhone || websiteSettings?.contactEmail) && (
        <p className="text-xs text-gray-500">
          {[websiteSettings.contactPhone, websiteSettings.contactEmail].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="text-xs text-gray-400">
        {mode === "shop" ? shopName ?? "Shop" : "LavLokshan"} · Cash on delivery · Guest checkout, no account needed
      </p>
      <p className="text-[11px] text-gray-300 mt-1">© {new Date().getFullYear()}</p>
    </footer>
  );
}
