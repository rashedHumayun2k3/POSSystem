"use client";

import Link from "next/link";
import { useCategories, CATEGORY_COLORS } from "@/lib/hooks";
import CategoryAvatar from "./CategoryAvatar";

export default function CategoryChips() {
  const { data } = useCategories();

  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-4 lg:px-8 pt-3">
        <h2 className="text-sm lg:text-base font-semibold text-gray-900">Shop by Category</h2>
        <Link href="/categories" className="text-xs lg:text-sm text-indigo-600">
          See all
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-x-1 gap-y-2 lg:gap-x-3 lg:gap-y-3">
        {data.map((c, i) => (
          <Link key={c.id} href={`/category/${c.id}`} className="flex flex-col items-center gap-0.5">
            <CategoryAvatar
              name={c.name}
              imageUrl={c.imageUrl}
              colorClass={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              className="w-20 h-20 lg:w-24 lg:h-24 text-2xl lg:text-3xl"
            />
            <span className="text-xs text-gray-700 text-center leading-tight line-clamp-2">{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
