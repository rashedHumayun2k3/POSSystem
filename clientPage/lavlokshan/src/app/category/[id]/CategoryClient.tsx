"use client";

import { use } from "react";
import TopHeader from "@/components/TopHeader";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import { useCategories } from "@/lib/hooks";

export default function CategoryClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: categories } = useCategories();
  const categoryName = categories?.find((c) => c.id === id)?.name;

  return (
    <main>
      <TopHeader />
      <div className="px-4 lg:px-8 py-3">
        <h1 className="text-base lg:text-xl font-semibold text-gray-900">{categoryName ?? "Category"}</h1>
      </div>
      <ProductGrid categoryId={id} />
      <Footer />
    </main>
  );
}
