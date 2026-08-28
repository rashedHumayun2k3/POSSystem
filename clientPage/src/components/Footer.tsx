"use client";

import { useShopContext } from "@/context/ShopContext";

export default function Footer() {
  const { mode, shopName } = useShopContext();

  return (
    <footer className="bg-white border-t border-gray-100 px-4 py-6 mt-2 text-center">
      <p className="text-xs text-gray-400">
        {mode === "shop" ? shopName ?? "Shop" : "LavLokshan"} · Cash on delivery · Guest checkout, no account needed
      </p>
      <p className="text-[11px] text-gray-300 mt-1">© {new Date().getFullYear()}</p>
    </footer>
  );
}
