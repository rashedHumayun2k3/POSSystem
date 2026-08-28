"use client";

import Link from "next/link";
import { useCategories } from "@/lib/hooks";

const fallbacks = ["Jerseys", "T-Shirts", "Shorts", "Joggers", "Accessories"];

const icons = [
  <path key="jersey" d="M8 4 5 6.5l2 3V20h10V9.5l2-3L16 4l-4 2-4-2Z" />,
  <path key="shoe" d="M5 13.5c2.5 1.8 5.2 2.4 8.2 1.6l3.9-1.1c1.2-.3 2.4.5 2.7 1.7l.2.8H4.5c-.8 0-1.5-.7-1.5-1.5v-2.9c.7.2 1.3.7 2 1.4Z" />,
  <path key="ball" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18v18M3.6 9h16.8M3.6 15h16.8" />,
  <path key="cap" d="M4 14c1.6-4 4.3-6 8-6s6.4 2 8 6H4Zm0 0c3.8 1.3 7.7 1.3 12 0l4 2" />,
  <path key="bag" d="M6 8h12l1 12H5L6 8Zm4 0V6a2 2 0 0 1 4 0v2" />,
  <path key="bolt" d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
];

export default function TossActiveCategoryStrip() {
  const { data } = useCategories();
  const categories = data?.slice(0, 6) ?? [];

  return (
    <section className="bg-[var(--toss-page)] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--toss-teal)]">Train by category</p>
            <h2 className="mt-1 text-2xl font-black uppercase text-[#1a1a1a] lg:text-4xl">Choose your lane</h2>
          </div>
          <Link href="/categories" className="hidden text-sm font-semibold underline underline-offset-4 sm:inline-flex">
            View all
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(categories.length > 0 ? categories : fallbacks.map((name) => ({ id: name, name }))).map((category, index) => (
            <Link
              key={category.id}
              href={categories.length > 0 ? `/category/${category.id}` : "/categories"}
              className="group relative flex min-h-44 flex-col justify-between overflow-hidden border border-[var(--toss-line)] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <span className="absolute -right-5 -top-6 text-8xl font-black text-[#1a1a1a]/5 group-hover:text-[var(--toss-yellow)]/30">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="grid h-16 w-16 place-items-center bg-[var(--toss-yellow)] text-[#1a1a1a] shadow-[0_12px_30px_rgba(244,200,56,0.26)] transition group-hover:scale-110">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  {icons[index % icons.length]}
                </svg>
              </span>
              <span>
                <span className="block text-lg font-black uppercase leading-tight text-[#1a1a1a]">{category.name}</span>
                <span className="mt-2 block h-1 w-10 bg-[var(--toss-maroon)] transition-all group-hover:w-16" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
