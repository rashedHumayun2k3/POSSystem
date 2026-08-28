"use client";

import Image from "next/image";
import { useState } from "react";

export default function TossCollectionYogaBanner() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <section className="bg-[#f9eeee] px-0 py-8 sm:py-12 lg:py-16">
      <div className="relative ml-0 mr-auto h-[240px] w-[95%] overflow-hidden rounded-br-[100px] bg-[#3b0d13] sm:h-[560px] sm:rounded-br-[180px] lg:h-[850px] lg:w-[85%] lg:rounded-br-[260px]">
        <Image
          src="/banners/yoga.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#160408]/45 via-[#430c15]/35 to-[#4b1119]/80" />
        <button
          type="button"
          aria-label="Watch video"
          onClick={() => setIsVideoOpen(true)}
          className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/70 sm:h-32 sm:w-32"
        >
          <span className="toss-yoga-ring toss-yoga-ring-back" aria-hidden="true" />
          <span className="toss-yoga-ring toss-yoga-ring-mid" aria-hidden="true" />
          <span className="toss-yoga-ring toss-yoga-ring-outer" aria-hidden="true" />
          <span className="toss-yoga-ring toss-yoga-ring-inner" aria-hidden="true" />
          <span className="toss-yoga-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
              <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.25-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </button>
      </div>
      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
          <button
            type="button"
            aria-label="Close video"
            onClick={() => setIsVideoOpen(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl leading-none text-black transition hover:bg-[#f4511e] hover:text-white"
          >
            ×
          </button>
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <video className="aspect-video w-full" src="/videos/yoga-video.mp4" controls autoPlay />
          </div>
        </div>
      )}
    </section>
  );
}
