"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useShopContext } from "@/context/ShopContext";

// To set a banner image: drop a file at clientPage/public/banners/slide-1.jpg (…slide-2.jpg, etc,
// matching the "image" path below) and it's picked up automatically — no code change needed after
// that. Any slide without a matching file just keeps showing its gradient.
const SLIDES = [
  {
    title: "Shop from all your favorite sellers",
    subtitle: "One marketplace, hundreds of shops",
    gradient: "from-indigo-600 via-indigo-500 to-fuchsia-500",
    icon: "🛍️",
    image: "/banners/slide-1.jpg",
  },
  {
    title: "Best Prices, Every Day",
    subtitle: "Compare and save across shops instantly",
    gradient: "from-emerald-600 via-teal-500 to-cyan-500",
    icon: "🏷️",
    image: "/banners/slide-2.jpg",
  },
  {
    title: "Fast Delivery Nationwide",
    subtitle: "Cash on delivery available everywhere",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    icon: "🚚",
    image: "/banners/slide-3.jpg",
  },
  {
    title: "New Arrivals Daily",
    subtitle: "Fresh stock from trusted local sellers",
    gradient: "from-fuchsia-600 via-purple-500 to-indigo-500",
    icon: "✨",
    image: "/banners/slide-4.jpg",
  },
];

const SLIDE_DURATION_MS = 4500;

function SlideBackground({ slide }: { slide: (typeof SLIDES)[number] }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !imgFailed;

  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} animate-hero-kenburns`} />
      {showImage && (
        <>
          <Image
            src={slide.image}
            alt=""
            fill
            className="object-cover animate-hero-kenburns"
            unoptimized
            onError={() => setImgFailed(true)}
          />
          {/* darken the photo a touch so the white title/subtitle text stays readable */}
          <div className="absolute inset-0 bg-black/25" />
        </>
      )}
    </>
  );
}

function MarketplaceHeroSlider() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const id = setTimeout(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(id);
  }, [active, isPaused]);

  return (
    <div
      className="relative w-full aspect-[16/7] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Promotional highlights"
    >
      {SLIDES.map((slide, i) => {
        const isActive = i === active;
        return (
          <div
            key={slide.title}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
            aria-hidden={!isActive}
          >
            <SlideBackground slide={slide} />
            {/* decorative floating blobs */}
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-white/10 blur-3xl animate-hero-float" />
            <div className="absolute -bottom-10 -right-6 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-hero-float-reverse" />

            <div className="relative h-full flex flex-col items-start justify-center text-white text-left px-6 sm:px-10 lg:px-16 max-w-2xl">
              <span
                className={`text-2xl sm:text-5xl mb-3 transition-all duration-700 ease-out ${
                  isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                }`}
              >
                {slide.icon}
              </span>
              <p
                className={`text-xl sm:text-5xl lg:text-6xl font-bold leading-tight drop-shadow-lg transition-all duration-700 ease-out delay-75 ${
                  isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                }`}
              >
                {slide.title}
              </p>
              <p
                className={`text-sm sm:text-2xl lg:text-3xl text-white/90 mt-3 drop-shadow-md transition-all duration-700 ease-out delay-150 ${
                  isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                }`}
              >
                {slide.subtitle}
              </p>
            </div>
          </div>
        );
      })}

      {/* dot indicators */}
      <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-1.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function PromoBanner() {
  const { mode, shopName, bannerUrl, websiteSettings } = useShopContext();
  const [bannerFailed, setBannerFailed] = useState(false);
  const [active, setActive] = useState(0);

  const shopSlides = mode === "shop"
    ? [bannerUrl, ...(websiteSettings?.sliderImageUrls ?? [])].filter((url): url is string => !!url)
    : [];

  useEffect(() => {
    if (shopSlides.length <= 1) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % shopSlides.length), SLIDE_DURATION_MS);
    return () => clearTimeout(id);
  }, [active, shopSlides.length]);

  if (mode === "shop" && shopSlides.length > 0 && !bannerFailed) {
    return (
      <div className="relative w-full aspect-[16/7] bg-gray-100 overflow-hidden">
        <Image
          src={shopSlides[active] ?? shopSlides[0]}
          alt={shopName ?? "Shop banner"}
          fill
          className="object-cover"
          unoptimized
          priority
          onError={() => setBannerFailed(true)}
        />
        {shopSlides.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-10 flex items-center justify-center gap-1.5">
            {shopSlides.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Go to banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === "shop") {
    return (
      <div className="relative w-full aspect-[16/7] bg-gradient-to-br from-indigo-600 via-indigo-500 to-fuchsia-500 flex flex-col items-center justify-center text-white text-center px-6">
        <p className="text-lg font-bold">{`Welcome to ${shopName ?? "our shop"}`}</p>
        <p className="text-sm text-white/80 mt-1">Quality products, delivered fast</p>
      </div>
    );
  }

  return <MarketplaceHeroSlider />;
}
