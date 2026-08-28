import Image from "next/image";
import Link from "next/link";

const PROMOS = [
  {
    eyebrow: "HOT SALE",
    title: "Women's\nRunning Gear",
    image: "/banners/promotion-1-left.jpg",
    className: "rounded-tr-[100px] sm:rounded-tr-[180px] lg:rounded-tr-[220px]",
  },
  {
    eyebrow: "NEW ARRIVALS",
    title: "Sports Gear\nFor Every Move",
    image: "/banners/promotion-1-right.jpg",
    className: "rounded-bl-[100px] sm:rounded-bl-[180px] lg:rounded-bl-[220px]",
  },
];

export default function TossCollectionPromoTiles() {
  return (
    <section className="grid gap-3 bg-white sm:grid-cols-2 sm:gap-6 lg:gap-12">
      {PROMOS.map((promo) => (
        <article
          key={promo.eyebrow}
          className={`group relative h-[250px] overflow-hidden bg-gray-900 ${promo.className} sm:h-[380px] lg:h-[650px]`}
        >
          <Image
            src={promo.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-0 left-[7%] right-0 p-6 text-white sm:left-[8%] sm:p-8 lg:left-[10%] lg:p-12">
            <p className="toss-promo-type mb-3 text-xs tracking-[0.12em] text-orange-400 sm:text-sm">
              {promo.eyebrow}
            </p>
            <h2 className="toss-promo-type whitespace-pre-line text-xl leading-tight sm:text-2xl lg:text-3xl">
              {promo.title}
            </h2>
            <Link
              href="/search"
              className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#f4511e] px-5 py-2.5 text-xs font-bold tracking-wide text-white transition hover:bg-[#d94114]"
            >
              Shop now
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
