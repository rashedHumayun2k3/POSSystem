"use client";

import { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
  errorMessage?: string;
}

const SCANNER_DIV_ID = "barcode-scanner-viewfinder";

export default function BarcodeScanner({ onScan, onClose, errorMessage }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const didScan = useRef(false);

  useEffect(() => {
    let stopped = false;

    const startScanner = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_DIV_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 120 } },
          (text) => {
            if (didScan.current || stopped) return;
            didScan.current = true;
            scanner.stop().catch(() => {});
            onScan(text);
          },
          () => {}
        );
      } catch {
        // Camera permission denied or not available — just close
        if (!stopped) onClose();
      }
    };

    startScanner();

    return () => {
      stopped = true;
      scannerRef.current?.stop().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
        <p className="text-white text-sm font-semibold tracking-wide">Point camera at barcode</p>
        <button
          onClick={() => {
            scannerRef.current?.stop().catch(() => {});
            onClose();
          }}
          className="text-white p-1"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        <div id={SCANNER_DIV_ID} className="w-full h-full" />
        {/* Targeting overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-60 h-28 border-2 border-white/70 rounded-lg relative">
            <span className="absolute -top-px -left-px w-5 h-5 border-t-4 border-l-4 border-indigo-400 rounded-tl" />
            <span className="absolute -top-px -right-px w-5 h-5 border-t-4 border-r-4 border-indigo-400 rounded-tr" />
            <span className="absolute -bottom-px -left-px w-5 h-5 border-b-4 border-l-4 border-indigo-400 rounded-bl" />
            <span className="absolute -bottom-px -right-px w-5 h-5 border-b-4 border-r-4 border-indigo-400 rounded-br" />
          </div>
        </div>
      </div>

      {/* Error or hint */}
      <div className="shrink-0 px-4 py-3 bg-black/80 text-center">
        {errorMessage ? (
          <p className="text-red-400 text-sm font-medium">{errorMessage}</p>
        ) : (
          <p className="text-gray-400 text-xs">Align barcode inside the frame</p>
        )}
      </div>
    </div>
  );
}
