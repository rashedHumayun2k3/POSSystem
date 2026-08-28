"use client";

import Link from "next/link";

export default function TossCollectionLifestyle() {
  return (
    <section className="toss-editorial" id="story">
      <div>
        <p>ACTIVE</p>
        <em>looks</em>
        <h2>
          EFFORTLESS
          <br />
          CONFIDENCE
        </h2>
        <Link className="toss-button" href="/search">DISCOVER MORE</Link>
      </div>
    </section>
  );
}
