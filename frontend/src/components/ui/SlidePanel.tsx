'use client';

import { useEffect, useState } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// Shared across every SlidePanel instance in the app — each panel grabs the next value the
// moment it opens, so whichever one opened MOST RECENTLY always stacks on top. Without this,
// two panels open at once (e.g. a picker like ProductPicker opened from inside another panel's
// form) both sat at the same fixed z-50, and which one visually won was decided by DOM order
// (wherever each happens to be written in its page's JSX) instead of open order — a panel opened
// later could end up rendering BEHIND the one it was opened from.
let panelZIndexCounter = 50;

export default function SlidePanel({ open, onClose, title, children, footer }: SlidePanelProps) {
  const [zIndex, setZIndex] = useState(50);

  useEffect(() => {
    if (open) {
      panelZIndexCounter += 10;
      setZIndex(panelZIndexCounter);
    }
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 flex items-end justify-center md:items-center md:p-6 ${open ? '' : 'pointer-events-none'}`}
      style={{ zIndex }}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 md:bg-black/40 md:duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* A single responsive panel keeps one React-owned copy of its children in the DOM.
          Rendering separate mobile and desktop copies caused both versions (including any
          autoFocus input) to mount and reconcile even though CSS hid one of them. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`relative w-full max-h-[90vh] bg-white rounded-t-2xl flex flex-col shadow-2xl transition-all duration-300 ease-in-out md:max-w-md md:max-h-[85vh] md:rounded-2xl md:duration-200 ${
          open
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-full opacity-0 md:translate-y-0 md:scale-95'
        }`}
      >
        <div className="shrink-0 flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 p-1 rounded-full hover:bg-gray-100 active:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="flex-1 text-base font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-4 py-3 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
