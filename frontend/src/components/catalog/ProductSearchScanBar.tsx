'use client';

import BarcodeScanner from '@/components/ui/BarcodeScanner';
import { QrCodeIcon } from '@heroicons/react/24/outline';

type ProductSearchScanBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  scanLabel: string;
  scannerOpen: boolean;
  onOpenScanner: () => void;
  onCloseScanner: () => void;
  onScan: (barcode: string) => void;
  error?: string;
};

export default function ProductSearchScanBar({
  value,
  onChange,
  placeholder,
  scanLabel,
  scannerOpen,
  onOpenScanner,
  onCloseScanner,
  onScan,
  error,
}: ProductSearchScanBarProps) {
  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
        </div>
        <button
          onClick={onOpenScanner}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shrink-0"
        >
          <QrCodeIcon className="w-4 h-4" />
          {scanLabel}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium mt-1 px-1">{error}</p>
      )}
      {scannerOpen && (
        <BarcodeScanner
          onScan={onScan}
          onClose={onCloseScanner}
        />
      )}
    </>
  );
}
