'use client';

import { useEffect } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function SlidePanel({ open, onClose, title, children, footer }: SlidePanelProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const header = (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
      <button
        onClick={onClose}
        className="text-gray-400 p-1 rounded-full hover:bg-gray-100 active:bg-gray-200"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h2 className="flex-1 text-base font-semibold text-gray-900">{title}</h2>
    </div>
  );

  const content = (
    <>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 px-4 py-3 border-t border-gray-100">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>

      {/* ── Mobile / tablet (< 768px): bottom sheet ──────────────────── */}

      {/* Full backdrop */}
      <div
        className={`md:hidden absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet — slides up from bottom */}
      <div
        className={`md:hidden absolute inset-x-0 bottom-0 bg-white rounded-t-2xl flex flex-col shadow-2xl transition-transform duration-300 ease-in-out max-h-[90vh] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle */}
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        {header}
        {content}
      </div>

      {/* ── Desktop (≥ 768px): centered modal ─────────────────────────── */}

      {/* Full-screen backdrop */}
      <div
        className={`hidden md:block absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Centered dialog */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center p-6">
        <div
          className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col transition-all duration-200 ${
            open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          {header}
          {content}
        </div>
      </div>

    </div>
  );
}
