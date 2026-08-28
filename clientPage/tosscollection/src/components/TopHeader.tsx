"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCartCount } from "@/store/cartStore";

const SearchIcon = () => <span aria-hidden="true">⌕</span>;
const AccountIcon = () => <span aria-hidden="true">♙</span>;
const BagIcon = () => <span aria-hidden="true">▢</span>;

export default function TopHeader({ initialQuery: _initialQuery }: { initialQuery?: string } = {}) {
  const cartCount = useCartCount();
  const [logoFailed, setLogoFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="toss-site-header">
      <button
        type="button"
        className="toss-mobile-menu-button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? "×" : "☰"}
      </button>

      <Link className="toss-brand" href="/">
        {!logoFailed ? (
          <Image
            src="/logo.png"
            alt="TOSS Collection"
            width={340}
            height={108}
            priority
            className="object-contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="toss-brand-text">
            <span>toss</span>
            <b>Collection</b>
            <small>active</small>
          </span>
        )}
      </Link>

      <nav className="toss-desktop-nav" aria-label="Main navigation">
        <Link href="/search">Shop</Link>
        <Link href="#new-arrival">New arrival</Link>
        <Link href="#story">Our Story</Link>
        <Link href="#journal">Journal</Link>
        <Link href="/contact">Contact</Link>
      </nav>

      {menuOpen && (
        <nav className="toss-mobile-nav" aria-label="Mobile navigation">
          <Link href="/search" onClick={() => setMenuOpen(false)}>Shop</Link>
          <Link href="#new-arrival" onClick={() => setMenuOpen(false)}>New arrival</Link>
          <Link href="#story" onClick={() => setMenuOpen(false)}>Our Story</Link>
          <Link href="#journal" onClick={() => setMenuOpen(false)}>Journal</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
        </nav>
      )}

      <div className="toss-header-actions">
        <Link href="/search" aria-label="Search"><SearchIcon /></Link>
        <Link href="/account" aria-label="Account"><AccountIcon /></Link>
        <Link href="/cart" aria-label="Shopping bag" className="relative">
          <BagIcon />
          {cartCount > 0 && (
            <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-[var(--toss-red)] text-[9px] font-bold text-white">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
