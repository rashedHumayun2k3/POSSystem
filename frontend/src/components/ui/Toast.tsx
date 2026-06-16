"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    if (type === "success") {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [type, onClose]);

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-xs w-full flex items-center gap-2 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span className="flex-1">{message}</span>
      {type === "error" && (
        <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
      )}
    </div>
  );
}
