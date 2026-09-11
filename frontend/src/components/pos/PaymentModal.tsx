'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createOrder, addOrderPayment } from '@/lib/ordersApi';
import { enqueueOfflineSale, isNetworkError } from '@/lib/posSync';
import type { PosSession } from '@/types/pos';
import { useToastStore } from '@/store/toastStore';

export type PayMethod = 'CASH' | 'BKASH' | 'CARD';

interface Props {
  session: PosSession;
  onClose: () => void;
  // offline=true means the sale was queued locally, not actually created on the server yet —
  // orderId/orderNo are placeholders in that case (see handleConfirm), not real order identifiers.
  onSuccess: (method: PayMethod, paidAmount: number, orderTotal: number, orderId: string, orderNo: string, offline: boolean) => void;
}

const METHODS: PayMethod[] = ['CASH', 'BKASH', 'CARD'];
const METHOD_LABEL: Record<PayMethod, string> = {
  CASH: 'Cash',
  BKASH: 'bKash',
  CARD: 'Card',
};

// Quick-rounding amounts for the cash numpad shortcuts
const ROUND_TO = [50, 100, 200, 500, 1000];

// Axios errors ARE instanceof Error, so a plain `err.message` gives the generic
// "Request failed with status code 409" instead of the server's actual explanation. Read the
// real body — for STOCK_UNAVAILABLE that includes exactly which item(s) are short.
function extractErrorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string; items?: string[] } } })?.response;
  if (response?.data?.items?.length) {
    return `${response.data.message ?? 'Insufficient stock'}\n${response.data.items.join('\n')}`;
  }
  if (response?.data?.message) return response.data.message;
  if (err instanceof Error) return err.message;
  return 'Payment failed. Please try again.';
}

function sessionSubtotal(session: PosSession): number {
  return session.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
}

function calcDiscount(session: PosSession, sub: number): number {
  if (!session.discountType || !session.discountValue) return 0;
  if (session.discountType === 'PERCENT') {
    return Math.round((sub * session.discountValue) / 100 * 100) / 100;
  }
  return Math.min(session.discountValue, sub);
}

export default function PaymentModal({ session, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [cashInput, setCashInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sub = sessionSubtotal(session);
  const discount = calcDiscount(session, sub);
  const total = sub - discount;
  const cashReceived = parseFloat(cashInput) || 0;
  const change = method === 'CASH' ? Math.max(0, cashReceived - total) : 0;
  const cashShort = method === 'CASH' && cashInput !== '' && cashReceived < total;

  const handleNumpad = (key: string) => {
    if (key === 'C') { setCashInput(''); return; }
    if (key === '⌫') { setCashInput(p => p.slice(0, -1)); return; }
    if (key === '.' && cashInput.includes('.')) return;
    setCashInput(p => {
      const next = p + key;
      // Max 2 decimal places
      const parts = next.split('.');
      if (parts[1] && parts[1].length > 2) return p;
      return next.replace(/^0+(\d)/, '$1');
    });
  };

  const quickAmount = (amt: number) => setCashInput(String(amt));

  const handleConfirm = async () => {
    if (method === 'CASH' && cashReceived < total) {
      useToastStore.getState().show('Cash received is less than the total.', 'error');
      return;
    }
    setLoading(true);
    const paidAmt = method === 'CASH' ? Math.min(cashReceived, total) : total;

    try {
      // Create POS order — channel=SHOP, isDraft=false, session.id as idempotency key.
      // isDraft:false makes the server auto-confirm (commit stock) as part of this same call, so
      // there's no separate confirm step here — calling confirm again afterward would either be a
      // wasted round trip (now a no-op server-side) or, before that fix, silently double-committed
      // stock on every sale.
      const order = await createOrder(
        {
          channel: 'SHOP',
          customerPhone: session.customerPhone || '00000000000',
          customerName: session.customerName || 'Walk-in',
          customerAddress: undefined,
          isDraft: false,
          items: session.items.map(i => ({
            variantId: i.variantId,
            qty: i.qty,
            unitPrice: i.unitPrice,
          })),
          discountType: session.discountType,
          discountValue: session.discountValue,
          deliveryChargeCustomer: 0,
          advancePaid: 0,
          note: session.note,
          clientUid: session.id,
        },
        session.id  // Idempotency-Key header
      );

      // Record the payment
      await addOrderPayment(order.id, { method, amount: paidAmt });

      onSuccess(method, paidAmt, total, order.id, order.orderNo, false);
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        // No network at all — queue the sale locally instead of blocking the cashier. session.id
        // doubles as the eventual order's Idempotency-Key, so this stays exactly as duplicate-safe
        // as the online path once it syncs (see lib/posSync.ts).
        await enqueueOfflineSale({
          id: session.id,
          channel: 'SHOP',
          customerName: session.customerName || 'Walk-in',
          customerPhone: session.customerPhone || '00000000000',
          items: session.items.map(i => ({ variantId: i.variantId, qty: i.qty, unitPrice: i.unitPrice })),
          discountType: session.discountType,
          discountValue: session.discountValue,
          note: session.note,
          method,
          paidAmount: paidAmt,
          total,
          createdAt: Date.now(),
        });
        useToastStore.getState().show('Saved offline — will sync when back online', 'success');
        onSuccess(method, paidAmt, total, session.id, 'Pending Sync', true);
        return;
      }
      useToastStore.getState().show(extractErrorMessage(err), 'error');
      setLoading(false);
    }
  };

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Payment</h2>
            <p className="text-xs text-gray-400">Session {session.label}</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-3">

          {/* Order summary */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm space-y-1">
            {session.items.map(i => (
              <div key={i.variantId} className="flex justify-between text-gray-600">
                <span className="truncate max-w-[180px]">
                  {i.productName}
                  {i.variantLabel && <span className="text-gray-400"> ({i.variantLabel})</span>}
                  {' ×'}{i.qty}
                </span>
                <span className="tabular-nums">৳{(i.unitPrice * i.qty).toLocaleString()}</span>
              </div>
            ))}
            {discount > 0 && (
              <div className="flex justify-between text-green-600 pt-1 border-t border-gray-200">
                <span>Discount</span>
                <span>− ৳{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
              <span>Total</span>
              <span className="tabular-nums">৳{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Method tabs */}
          <div className="flex gap-1.5">
            {METHODS.map(m => (
              <button
                key={m}
                onClick={() => { setMethod(m); setCashInput(''); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  method === m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>

          {/* Cash-specific: numpad + change */}
          {method === 'CASH' && (
            <>
              {/* Cash received display */}
              <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${cashShort ? 'bg-red-50' : 'bg-gray-50'}`}>
                <span className="text-sm text-gray-500">Cash received</span>
                <span className={`text-xl font-bold tabular-nums ${cashShort ? 'text-red-600' : 'text-gray-900'}`}>
                  ৳{cashInput || '0'}
                </span>
              </div>

              {/* Change */}
              {cashReceived >= total && cashInput !== '' && (
                <div className="bg-green-50 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-green-700 font-medium">Change to give back</span>
                  <span className="text-base font-bold text-green-700 tabular-nums">
                    ৳{change.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-1.5">
                {numpadKeys.map(k => (
                  <button
                    key={k}
                    onClick={() => handleNumpad(k)}
                    className="py-1 rounded-xl bg-gray-50 text-gray-900 font-semibold text-lg hover:bg-gray-100 active:bg-gray-200 transition-colors select-none"
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Clear */}
              <button
                onClick={() => handleNumpad('C')}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>

              {/* Quick round amounts */}
              <div className="flex gap-1.5 flex-wrap">
                {ROUND_TO.map(base => {
                  const amt = Math.ceil(total / base) * base;
                  return (
                    <button
                      key={base}
                      onClick={() => quickAmount(amt)}
                      className="flex-1 min-w-[56px] py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                    >
                      ৳{amt.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Non-cash info */}
          {method !== 'CASH' && (
            <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
              <p className="text-sm text-gray-500">
                Collect <span className="font-bold text-gray-900">৳{total.toLocaleString()}</span> via {METHOD_LABEL[method]}
              </p>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={loading || (method === 'CASH' && (cashInput === '' || cashReceived < total))}
            className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-700 transition-colors"
          >
            {loading ? 'Processing…' : `Confirm ${METHOD_LABEL[method]} Payment`}
          </button>
        </div>
      </div>
    </div>
  );
}
