"use client";

import Image from "next/image";
import Link from "next/link";
import { useShopContext } from "@/context/ShopContext";

export default function Footer() {
  const { shopName, websiteSettings } = useShopContext();
  const email = websiteSettings?.contactEmail ?? "hello@tosscollection.com";

  return (
    <footer className="toss-site-footer" id="contact">
      <div className="toss-footer-panel relative ml-0 mr-auto overflow-hidden">
        <Image
          src="/banners/footer-image.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-left"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#f9eeee]/15" aria-hidden="true" />

        <div className="toss-footer-brand relative z-10">
          <Link className="toss-brand toss-brand-text" href="/">
            <span>toss</span>
            <b>Collection</b>
            <small>active</small>
          </Link>
          <p>{shopName ?? "TOSS Collection"} · Move more. Live limitless.</p>
          <div className="toss-social-links">◎　◉　◌　◍</div>
        </div>

        <div className="relative z-10">
          <h3>About</h3>
          <Link href="/about">Our story</Link>
          <Link href="/contact">Careers</Link>
          <Link href="#journal">Journal</Link>
        </div>

        <div className="relative z-10">
          <h3>Help</h3>
          <Link href="/delivery-policy">Shipping & returns</Link>
          <Link href="/return-policy">Size guide</Link>
          <Link href="/privacy-policy">Privacy policy</Link>
          <Link href="/terms">Terms</Link>
        </div>

        <div className="relative z-10">
          <h3>Contact</h3>
          <a href={`mailto:${email}`}>{email}</a>
          {websiteSettings?.contactPhone && <a href={`tel:${websiteSettings.contactPhone}`}>{websiteSettings.contactPhone}</a>}
          <Link href="/contact">Find a store</Link>
        </div>

        <div className="toss-newsletter relative z-10">
          <h3>Stay In Motion</h3>
          <p>Get product drops and movement inspiration.</p>
          <form>
            <input type="email" placeholder="Your email address" />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
    </footer>
  );
}
