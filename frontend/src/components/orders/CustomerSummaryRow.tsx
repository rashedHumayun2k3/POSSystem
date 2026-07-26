"use client";

import { UserCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Shared "selected customer chip, or dashed add-customer button" display — sits next to
// CustomerPickerSlide (the actual search/add-new-customer logic) wherever a screen lets the
// customer be optional. Used by POS (CartPanel) and hawker night-entry; keep both in sync here
// instead of copy-pasting this markup again.
interface Props {
  customerName: string;
  customerPhone: string;
  addLabel: string;
  onAdd: () => void;
  onClear: () => void;
}

export default function CustomerSummaryRow({ customerName, customerPhone, addLabel, onAdd, onClear }: Props) {
  if (customerName) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
        <UserCircleIcon className="w-4 h-4 text-indigo-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-700 truncate">{customerName}</p>
          <p className="text-xs text-indigo-400">{customerPhone}</p>
        </div>
        <button onClick={onClear} className="text-indigo-300 hover:text-indigo-500">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
    >
      <UserCircleIcon className="w-4 h-4 shrink-0" />
      <span>{addLabel}</span>
    </button>
  );
}
