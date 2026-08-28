"use client";

import Link from "next/link";
import Image from "next/image";

const CATEGORIES = [
  { name: "Running Shoes", description: "Run Fast. Land Safe", image: "/category-img/running-shoes.jpg", color: "bg-[#edf3fa]" },
  { name: "Shorts", description: "Your Most Comfortable Move", image: "/category-img/shorts.jpg", color: "bg-[#f1f5e7]" },
  { name: "Accessories", description: "The Gear Behind Your Game", image: "/category-img/accessories.jpeg", color: "bg-[#faeef0]" },
  //{ name: "Joggers & Pants", image: "/category-img/joggers-pants.jpg", color: "bg-[#f5f0e7]" },
  //{ name: "Gym Wear", image: "/category-img/gym-wear.jpg", color: "bg-[#ececf8]" },
  //{ name: "Cycling Gear", image: "/category-img/cycling-gear.jpg", color: "bg-[#f8eee9]" },
  //{ name: "Cycling Sunglasses", image: "/category-img/cycling-sunglasses.jpg", color: "bg-[#edf4ed]" },
  //{ name: "Swimming Gear", image: "/category-img/swimming-gear.jpg", color: "bg-[#eef2f8]" },
];

export default function CategoryChips() {
  return (
    <section className="bg-white px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1700px] text-center">
        <p className="toss-promo-type mb-2 text-xs tracking-[0.14em] text-orange-500">Our Category</p>
        <h2 className="toss-promo-type mb-8 text-2xl font-medium leading-tight text-[#17202a] sm:text-3xl lg:text-4xl">Category By Sport</h2>
      </div>
      <div className="mx-auto grid max-w-[1700px] justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => (
          <Link key={category.name} href="/categories" className={`group relative flex min-h-[300px] w-full max-w-[560px] items-center overflow-hidden rounded-2xl ${category.color}`}>
            <Image
              src={category.image}
              alt={category.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
              quality={95}
              className="object-cover object-right transition duration-500 group-hover:scale-105"
            />
            <div className="relative z-10 max-w-[58%] px-5 py-6 text-left sm:px-6">
              <h3 className="toss-promo-type text-base font-medium leading-tight text-[#1d2329] sm:text-lg">{category.name}</h3>
              <span className="mt-2 block text-xs text-gray-500">{category.description ?? "Explore collection"}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
