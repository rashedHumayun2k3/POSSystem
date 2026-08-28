"use client";

import Image from "next/image";

const posts = [
  "/banners/tossactive-slide-1.png",
  "/banners/tossactive-slide-2.png",
  "/banners/tossactive-slide-3.png",
  "/banners/slide-1.jpg",
  "/banners/slide-2.jpg",
  "/banners/slide-3.jpg",
  "/banners/slide-4.jpg",
  "/banners/slide-5.jpg",
  "/banners/tossactive-slide-1.png",
  "/banners/tossactive-slide-2.png",
  "/banners/tossactive-slide-3.png",
  "/banners/slide-1.jpg",
];

export default function TossCollectionSocialBand() {
  return (
    <section className="toss-social" id="journal">
      <div className="toss-social-title">
        <span>@</span>
        <h2>
          FOLLOW THE
          <br />
          MOVEMENT
        </h2>
      </div>
      <div className="toss-social-grid">
        {posts.map((post, index) => (
          <div key={`${post}-${index}`} className="relative aspect-square overflow-hidden bg-[linear-gradient(135deg,#153f4f,#e79b48_75%,#111)]">
            <Image src={post} alt="" fill className="object-cover opacity-70 transition duration-500 hover:scale-105 hover:opacity-100" unoptimized />
          </div>
        ))}
      </div>
    </section>
  );
}
