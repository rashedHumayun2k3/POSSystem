"use client";

import Link from "next/link";
import { useCategories, CATEGORY_COLORS } from "@/lib/hooks";

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
      <div className="flex gap-4 lg:gap-6 overflow-x-auto px-4 lg:px-8 py-3 no-scrollbar">
        {data.map((c, i) => (
          <Link key={c.id} href={`/category/${c.id}`} className="flex flex-col items-center gap-1.5 shrink-0 w-16 lg:w-20">
            <div
              className={`w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-lg lg:text-xl font-bold ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
            >
              {c.name[0]?.toUpperCase()}
            </div>
            <span className="text-[11px] text-gray-700 text-center leading-tight line-clamp-2">{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
