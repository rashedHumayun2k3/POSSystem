"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  // Errors get longer on screen than success (more important, worth actually reading) but still
  // auto-dismiss — a message that never goes away on its own just becomes something to ignore.
  useEffect(() => {
    const t = setTimeout(onClose, type === "success" ? 2000 : 5000);
    return () => clearTimeout(t);
  }, [type, onClose]);

  return (
    // Success: mobile gets a bottom sheet (thumb-reachable, above the bottom tab bar), desktop
    // gets a traditional top banner. Error: always a top banner regardless of screen size — an
    // error is more urgent/blocking than a success confirmation, so it gets a persistent,
    // immediately-visible placement instead of competing for attention near the thumb.
    <div
      className={`fixed z-50 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-xs w-[calc(100%-2rem)] flex items-center gap-2 ${
        type === "success" ? "bottom-20 md:bottom-auto md:top-4 bg-green-600" : "top-4 bg-red-600"
      }`}
    >
      <span className="flex-1">{message}</span>
      {type === "error" && (
        <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
      )}
    </div>
  );
}
