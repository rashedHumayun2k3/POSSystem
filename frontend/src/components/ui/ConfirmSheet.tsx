"use client";

import { ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleClassName?: string;
  note?: string;
  children?: ReactNode;
  closeLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  confirmClassName?: string;
  confirmDisabled?: boolean;
}

// Shared bottom sheet for every "are you sure?" style prompt in the app (confirm order, deliver,
// handover, return, cancel, delete, …) — same backdrop/drag-handle/title/Close+Confirm shell,
// with the per-action bits (title, note, extra fields, button color/label) passed in as props.
export default function ConfirmSheet({
  open,
  onClose,
  title,
  titleClassName = "text-gray-900",
  note,
  children,
  closeLabel,
  confirmLabel,
  onConfirm,
  confirmClassName = "bg-indigo-600 text-white",
  confirmDisabled = false,
}: ConfirmSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 p-1 rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
        <p className={`text-base font-semibold pr-6 ${titleClassName}`}>{title}</p>
        {note && <p className="text-sm text-gray-500">{note}</p>}
        {children}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
          >
            {closeLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
