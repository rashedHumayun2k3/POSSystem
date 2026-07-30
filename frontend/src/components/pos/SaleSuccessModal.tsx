'use client';

import { useState } from 'react';
import { CheckCircleIcon, PrinterIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { downloadReceipt } from '@/lib/ordersApi';
import type { PayMethod } from './PaymentModal';

interface Props {
  orderId: string;
  orderNo: string;
  total: number;
  paidAmount: number;
  method: PayMethod;
  customerPhone?: string;
  // true = this sale was queued offline — orderId/orderNo are local placeholders, not real server
  // identifiers yet, so Print (which fetches a PDF by order id) has nothing to fetch until sync.
  offline: boolean;
  businessName: string;
  onNewSale: () => void;
}

const METHOD_LABEL: Record<PayMethod, string> = {
  CASH: 'Cash',
  BKASH: 'bKash',
  CARD: 'Card',
};

// Normalizes a BD-style local number (01xxxxxxxxx) to E.164 (8801xxxxxxxxx) for wa.me links.
// Leaves already-international or non-standard input as-is rather than guessing further.
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  return digits;
}

export default function SaleSuccessModal({
  orderId, orderNo, total, paidAmount, method, customerPhone, offline, businessName, onNewSale,
}: Props) {
  const [printing, setPrinting] = useState(false);
  const change = method === 'CASH' ? Math.max(0, paidAmount - total) : 0;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await downloadReceipt(orderId);
    } finally {
      setPrinting(false);
    }
  };

  const handleWhatsApp = () => {
    const lines = [
      `${businessName} — Receipt ${orderNo}`,
      `Total: ৳${total.toLocaleString()}`,
      `Paid via ${METHOD_LABEL[method]}${change > 0 ? ` (change ৳${change.toLocaleString()})` : ''}`,
      `Thank you for shopping with us!`,
    ];
    const text = encodeURIComponent(lines.join('\n'));
    const number = customerPhone ? toWhatsAppNumber(customerPhone) : '';
    const url = number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
        <CheckCircleIcon className={`w-16 h-16 mx-auto mb-3 ${offline ? 'text-amber-500' : 'text-green-500'}`} />
        <h2 className="text-lg font-bold text-gray-900">{offline ? 'Saved Offline' : 'Payment Successful'}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {offline ? 'Will sync automatically once back online' : `Order ${orderNo}`}
        </p>

        <div className="bg-gray-50 rounded-xl px-4 py-3 mt-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Total</span>
            <span className="font-semibold text-gray-900 tabular-nums">৳{total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Paid via</span>
            <span className="font-semibold text-gray-900">{METHOD_LABEL[method]}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Change given</span>
              <span className="font-semibold tabular-nums">৳{change.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handlePrint}
            disabled={printing || offline}
            title={offline ? 'Available once this sale has synced' : undefined}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50"
          >
            <PrinterIcon className="w-4 h-4" />
            {printing ? '…' : 'Print'}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-medium text-sm"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            WhatsApp
          </button>
        </div>

        <button
          onClick={onNewSale}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm mt-3 active:bg-indigo-700 transition-colors"
        >
          New Sale
        </button>
      </div>
    </div>
  );
}
