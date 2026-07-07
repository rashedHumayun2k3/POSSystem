'use client';

import { useState } from 'react';
import type { PosShift } from '@/types/pos';

interface Props {
  mode: 'open' | 'close';
  shift: PosShift | null;
  cashierName: string;
  onOpen: (shift: PosShift) => void;
  onClose: () => void;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-800'}>{value}</span>
    </div>
  );
}

export default function ShiftModal({ mode, shift, cashierName, onOpen, onClose }: Props) {
  const [float, setFloat] = useState('');

  if (mode === 'open') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Open Shift</h2>
              <p className="text-xs text-gray-500">Hello, {cashierName}</p>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opening Balance in Drawer (৳)
          </label>
          <input
            type="number"
            min="0"
            value={float}
            onChange={e => setFloat(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-5"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const newShift: PosShift = {
                  id: crypto.randomUUID(),
                  openedAt: new Date().toISOString(),
                  openingFloat: parseFloat(float) || 0,
                  cashierName,
                  salesCount: 0,
                  totalSales: 0,
                  totalCash: 0,
                };
                onOpen(newShift);
              }
            }}
          />

          <button
            onClick={() => {
              const newShift: PosShift = {
                id: crypto.randomUUID(),
                openedAt: new Date().toISOString(),
                openingFloat: parseFloat(float) || 0,
                cashierName,
                salesCount: 0,
                totalSales: 0,
                totalCash: 0,
              };
              onOpen(newShift);
            }}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-base active:bg-indigo-700 transition-colors"
          >
            Open Shift
          </button>
        </div>
      </div>
    );
  }

  // Close mode — Z-report
  if (!shift) return null;
  const expectedCash = shift.openingFloat + shift.totalCash;
  const openedTime = new Date(shift.openedAt).toLocaleTimeString('en-BD', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const closedAtDisplay = new Date().toLocaleString('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:static print:bg-white print:p-0">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl print:shadow-none print:rounded-none print:max-w-full">
        <h2 className="text-base font-bold text-gray-900 mb-4 print:hidden">Close Shift — Z Report</h2>

        {/* Printable report — shown on screen too, but this is what survives print:hidden on everything else */}
        <div className="hidden print:block mb-4">
          <p className="text-lg font-bold text-center">Z Report</p>
          <p className="text-xs text-center text-gray-500">{closedAtDisplay}</p>
        </div>

        <div className="text-sm divide-y divide-gray-50 mb-6">
          <Row label="Cashier" value={shift.cashierName} />
          <Row label="Opened at" value={openedTime} />
          <Row label="Total orders" value={`${shift.salesCount}`} />
          <Row label="Total sales" value={`৳${shift.totalSales.toLocaleString()}`} />
          <div className="pt-2 mt-1 space-y-1">
            <Row label="Opening Balance in Drawer" value={`৳${shift.openingFloat.toLocaleString()}`} />
            <Row label="Cash received" value={`৳${shift.totalCash.toLocaleString()}`} />
            <Row label="Expected in drawer" value={`৳${expectedCash.toLocaleString()}`} bold />
          </div>
        </div>

        <div className="flex gap-3 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-medium text-sm"
          >
            Print
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('pos_shift');
              window.location.reload();
            }}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm active:bg-red-700 transition-colors"
          >
            Close Shift
          </button>
        </div>
      </div>
    </div>
  );
}
