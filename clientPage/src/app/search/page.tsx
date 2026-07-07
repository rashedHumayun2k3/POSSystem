"use client";

import { useSearchParams } from "next/navigation";
import TopHeader from "@/components/TopHeader";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  return (
    <main>
      <TopHeader initialQuery={q} />
      <div className="px-4 lg:px-8 py-3">
        <h1 className="text-base lg:text-xl font-semibold text-gray-900">
          {q ? `Results for "${q}"` : "Search"}
        </h1>
      </div>
      <ProductGrid q={q} />
      <Footer />
    </main>
  );
}
