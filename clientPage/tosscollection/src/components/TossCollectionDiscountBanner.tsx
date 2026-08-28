import Image from "next/image";
import Link from "next/link";

export default function TossCollectionDiscountBanner() {
  return (
    <section className="bg-[#f9eeee] px-0 py-8 sm:py-12 lg:py-16">
      <div className="relative ml-auto mr-0 h-[240px] w-[95%] overflow-hidden rounded-bl-[100px] bg-[#3b0d13] sm:h-[480px] sm:rounded-bl-[180px] lg:h-[750px] lg:w-[85%] lg:rounded-bl-[260px]">
        <Image
          src="/banners/offer-banner.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-left"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#160408]/45 via-[#430c15]/35 to-[#4b1119]/80" />
        <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center px-8 text-white sm:w-1/2 sm:justify-start sm:px-10 lg:px-20">
          <div>
            <p className="toss-promo-type mb-4 text-xs tracking-[0.12em] text-orange-400">Special Discount Sale</p>
            <h2 className="toss-promo-type max-w-[420px] whitespace-pre-line text-3xl leading-tight sm:text-4xl lg:text-5xl">
              {"Get 35% Off\nEverything !"}
            </h2>
            <Link href="/search" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#f4511e] px-6 py-3 text-xs uppercase tracking-wide text-white transition hover:bg-[#d94114]">
              Shop now <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
