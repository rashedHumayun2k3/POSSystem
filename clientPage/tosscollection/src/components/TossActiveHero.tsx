"use client";

import Image from "next/image";
import Link from "next/link";
import { useShopContext } from "@/context/ShopContext";
import { resolveMediaUrl } from "@/lib/media";

export default function TossActiveHero() {
  const { bannerUrl, websiteSettings } = useShopContext();
  const sliderImages = [bannerUrl, ...(websiteSettings?.sliderImageUrls ?? [])].filter((url): url is string => !!url);
  const firstImage = resolveHeroImage(sliderImages[0] ?? "/banners/tossactive-slide-1.png");
  const secondImage = resolveHeroImage(sliderImages[1] ?? "/banners/tossactive-slide-2.png");

  return (
    <>
      <section className="toss-hero toss-hero-one">
        <div className="toss-hero-media">
          <Image src={firstImage} alt="" fill className="object-cover object-center" priority unoptimized />
        </div>
        <div className="toss-hero-copy">
          <p>THE NEW SEASON</p>
          <h1>
            GET
            <br />
            <strong>MOVE</strong>
            <br />
            MORE
          </h1>
          <Link className="toss-button" href="/search">SHOP NOW</Link>
        </div>
      </section>

      <section className="toss-hero toss-hero-two">
        <div className="toss-hero-media">
          <Image src={secondImage} alt="" fill className="object-cover object-center" unoptimized />
        </div>
        <div className="toss-hero-copy light">
          <p>
            FEEL YOUR
            <br />
            <strong>POWER</strong>
          </p>
          <h2>
            WEAR THE
            <br />
            DIFFERENCE
          </h2>
          <Link className="toss-button toss-button-outline" href="/categories">
            EXPLORE COLLECTION
          </Link>
        </div>
      </section>
    </>
  );
}

function resolveHeroImage(image: string) {
  return image.startsWith("/") ? image : resolveMediaUrl(image) ?? image;
}
