'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

// Replaces a native <select> everywhere it's used across the app — a native select's open popup
// is rendered by the browser/OS itself, not by this component's CSS, and was reliably overflowing
// past the screen edge on mobile once option labels got long (variant names, category names,
// courier names, etc).
//
// The dropdown panel is rendered through a portal straight into <body>, positioned with `fixed`
// coordinates measured from the trigger button — not as a plain absolutely-positioned child of the
// trigger's own wrapper. That distinction matters because this component gets used inside
// scrollable containers (e.g. SlidePanel's content area): an absolutely positioned descendant
// still inflates an `overflow: auto` ancestor's scrollHeight even though it's out of normal flow,
// which was visibly expanding the sheet's height instead of the dropdown floating over it. A
// portal escapes that scrollable ancestor's containing block entirely.
export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  triggerClassName,
  disabled,
  searchable = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleOptions = searchable && normalizedSearch
    ? options.filter((opt) => opt.label.toLowerCase().includes(normalizedSearch))
    : options;

  useEffect(() => setMounted(true), []);

  const openDropdown = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setSearch('');
    setOpen(true);
    if (searchable) window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  // Closes on scroll anywhere (capture phase catches scroll on nested scrollable ancestors too,
  // e.g. the SlidePanel content area) and on resize, rather than trying to keep a fixed-position
  // panel glued to a trigger that just moved — matches how most native/browser dropdowns behave.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={
          triggerClassName ??
          'w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-left disabled:opacity-50'
        }
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ''}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {mounted && open && position && createPortal(
        <>
          {/* Full-screen transparent backdrop — closes the dropdown on outside tap. z-index is
              deliberately way above any realistic SlidePanel stacking depth (SlidePanel hands out
              its own z-index in +10 steps starting at 50) — a dropdown is inherently the topmost,
              most ephemeral thing on screen and must never end up trapped under a panel it's
              nested inside, however deep that nesting gets. */}
          <button type="button" onClick={() => setOpen(false)} className="fixed inset-0 z-[9998]" aria-label="Close" />
          <div
            className="fixed z-[9999] max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {searchable && (
              <div className="sticky top-0 z-10 bg-white px-2 pb-1 pt-1">
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false);
                  }}
                  placeholder={searchPlaceholder ?? placeholder ?? ''}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>
            )}
            {visibleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setSearch(''); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm truncate ${
                  opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 active:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {visibleOptions.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-gray-400">
                {noResultsLabel ?? 'No matches'}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
