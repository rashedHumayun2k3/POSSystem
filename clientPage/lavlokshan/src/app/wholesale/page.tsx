"use client";

import TopHeader from "@/components/TopHeader";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";

export default function WholesalePage() {
  return (
    <main>
      <TopHeader />
      <div className="px-4 lg:px-8 py-3">
        <h1 className="text-base lg:text-xl font-semibold text-gray-900">Wholesale Deals</h1>
        <p className="text-xs text-gray-500 mt-0.5">Products with bulk pricing — buy more, pay less per piece.</p>
      </div>
      <ProductGrid sort="wholesale" />
      <Footer />
    </main>
  );
}
