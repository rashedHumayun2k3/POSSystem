"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/media";
import { getYoutubeEmbedId } from "@/lib/youtube";

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
    <path d="M8 5v14l11-7z" />
  </svg>
);

type Slide = { type: "image"; url: string } | { type: "video"; embedId: string };

export default function ProductGallery({
  mainImageUrl,
  images,
  youtubeUrl,
  alt,
}: {
  mainImageUrl?: string;
  images: string[];
  youtubeUrl?: string | null;
  alt: string;
}) {
  const embedId = youtubeUrl ? getYoutubeEmbedId(youtubeUrl) : null;

  // Extra gallery photos take priority; if a seller hasn't uploaded any, fall back to the single
  // required product photo so nothing regresses for products without a gallery.
  const slides: Slide[] =
    images.length > 0
      ? images.map((url) => ({ type: "image" as const, url }))
      : mainImageUrl
      ? [{ type: "image" as const, url: mainImageUrl }]
      : [];
  if (embedId) slides.push({ type: "video", embedId });

  const [selected, setSelected] = useState(0);
  const activeSlide = slides[selected];

  const rootClass =
    "max-w-[280px] lg:max-w-none mx-auto lg:mx-0 lg:w-[336px] lg:shrink-0 lg:sticky lg:top-24 lg:self-start";

  if (slides.length === 0) {
    return (
      <div className={rootClass}>
        <div className="relative aspect-square bg-gray-100 lg:w-[260px] lg:rounded-xl flex items-center justify-center text-gray-300 text-sm">
          No image
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="flex flex-col-reverse lg:flex-row lg:items-start gap-2">
        {/* Thumbnail rail — horizontal scroll below the main image on mobile, vertical column to
            its left on desktop (matches the Amazon-style layout this mirrors). */}
        {slides.length > 1 && (
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:w-14 lg:order-first">
            {slides.map((slide, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={`relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${
                  i === selected ? "border-indigo-600" : "border-gray-200"
                }`}
              >
                {slide.type === "video" ? (
                  <>
                    <img
                      src={`https://img.youtube.com/vi/${slide.embedId}/default.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <PlayIcon />
                    </span>
                  </>
                ) : (
                  <img src={resolveMediaUrl(slide.url) ?? ""} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="relative aspect-square bg-gray-100 w-full lg:w-[260px] lg:rounded-xl overflow-hidden shrink-0">
          {activeSlide.type === "video" ? (
            <iframe
              src={`https://www.youtube.com/embed/${activeSlide.embedId}`}
              title={alt}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <Image
              src={resolveMediaUrl(activeSlide.url) ?? ""}
              alt={alt}
              fill
              className="object-contain lg:rounded-xl"
              unoptimized
            />
          )}
        </div>
      </div>
    </div>
  );
}
