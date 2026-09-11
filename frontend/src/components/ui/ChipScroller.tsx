'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/i18n/LanguageContext';

export interface ChipOption {
  id: string;
  name: string;
}

interface Props {
  options: ChipOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  // Pass a label to prepend an "All" chip (using allId as its id, default 'ALL'); omit for none.
  allLabel?: string;
  allId?: string;
  sticky?: boolean;
  className?: string;
}

// Horizontal scrollable chip row (category filters, etc.) with left/right arrow buttons that
// only appear on whichever side still has more content to scroll to — needed on mobile, where a
// row wider than the screen has no other visible hint that swipe-scrolling is possible.
export default function ChipScroller({ options, selectedId, onSelect, allLabel, allId = 'ALL', sticky = true, className }: Props) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  // Re-check once the chips have actually laid out (options arriving async, panel opening) — a
  // rAF instead of running synchronously since scrollWidth isn't reliable until paint.
  useEffect(() => {
    const raf = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(raf);
  }, [options]);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' });
  };

  const chipClass = (active: boolean) =>
    `shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  return (
    <div className={`relative border-b border-gray-100 bg-white ${sticky ? 'sticky top-0 z-10' : ''} ${className ?? ''}`}>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide"
      >
        {allLabel && (
          <button onClick={() => onSelect(allId)} className={chipClass(selectedId === allId)}>
            {allLabel}
          </button>
        )}
        {options.map((opt) => (
          <button key={opt.id} onClick={() => onSelect(opt.id)} className={chipClass(selectedId === opt.id)}>
            {opt.name}
          </button>
        ))}
      </div>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label={t('common.scrollLeft')}
          className="absolute left-0.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-500" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label={t('common.scrollRight')}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center"
        >
          <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500" />
        </button>
      )}
    </div>
  );
}
