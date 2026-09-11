"use client";

import Link from "next/link";
import TopHeader from "@/components/TopHeader";
import { useCategories, CATEGORY_COLORS } from "@/lib/hooks";
import CategoryAvatar from "@/components/CategoryAvatar";

export default function AllCategoriesPage() {
  const { data, isLoading } = useCategories();

  return (
    <main>
      <TopHeader />
      <div className="px-4 lg:px-8 py-3">
        <h1 className="text-base lg:text-xl font-semibold text-gray-900">All Categories</h1>
      </div>

      {isLoading && <div className="p-6 text-center text-sm text-gray-400">Loading…</div>}
      {!isLoading && (!data || data.length === 0) && (
        <div className="p-6 text-center text-sm text-gray-400">No categories yet.</div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 px-4 lg:px-8 pb-6">
        {data?.map((c, i) => (
          <Link key={c.id} href={`/category/${c.id}`} className="flex flex-col items-center gap-1.5">
            <CategoryAvatar
              name={c.name}
              imageUrl={c.imageUrl}
              colorClass={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              className="w-16 h-16 text-xl"
            />
            <span className="text-xs text-gray-700 text-center leading-tight line-clamp-2">{c.name}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
