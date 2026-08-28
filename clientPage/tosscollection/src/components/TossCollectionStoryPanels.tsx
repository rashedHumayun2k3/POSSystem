"use client";

import Link from "next/link";

export default function TossCollectionStoryPanels() {
  return (
    <section className="toss-split-feature" id="collections">
      <FeatureCard tone="dark" title="LIVE LIMITLESS" subtitle="MOVE WITHOUT LIMITS" href="/search?q=men" cta="SHOP MEN" />
      <FeatureCard tone="mono" title="LIVE LIMITLESS" subtitle="STYLE IN MOTION" href="/search?q=women" cta="SHOP WOMEN" />
    </section>
  );
}

function FeatureCard({
  tone,
  title,
  subtitle,
  href,
  cta,
}: {
  tone: "dark" | "mono";
  title: string;
  subtitle: string;
  href: string;
  cta: string;
}) {
  return (
    <div className={`toss-feature-card ${tone === "dark" ? "toss-dark-card" : "toss-mono-card"}`}>
      <span>{title}</span>
      <small>{subtitle}</small>
      <Link href={href}>{cta}</Link>
    </div>
  );
}
