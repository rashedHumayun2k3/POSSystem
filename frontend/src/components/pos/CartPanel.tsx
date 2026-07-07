'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  QrCodeIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { posDb } from '@/lib/posDb';
import { lookupBarcode, searchProducts } from '@/lib/catalogApi';
import type { PosSession, PosCartItem } from '@/types/pos';
import type { ProductSearchResult } from '@/types/catalog';
import BarcodeScanner from '@/components/ui/BarcodeScanner';
import CustomerPickerSlide, { type SelectedCustomer } from '@/components/orders/CustomerPickerSlide';

interface Props {
  session: PosSession;
  onPayClick: () => void;
}

function parseVariantLabel(variantValuesJson: string): string {
  if (!variantValuesJson) return '';
  try {
    const obj = JSON.parse(variantValuesJson) as Record<string, string>;
    const vals = Object.values(obj).filter(Boolean);
    return vals.join(' / ');
  } catch {
    return '';
  }
}

function sessionSubtotal(session: PosSession): number {
  return session.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
}

function calcDiscount(session: PosSession): number {
  if (!session.discountType || !session.discountValue) return 0;
  const sub = sessionSubtotal(session);
  if (session.discountType === 'PERCENT') {
    return Math.round((sub * session.discountValue) / 100 * 100) / 100;
  }
  return Math.min(session.discountValue, sub);
}

export default function CartPanel({ session, onPayClick }: Props) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanError, setScanError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [showDiscount, setShowDiscount] = useState(
    !!(session.discountType && session.discountValue)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset search when session switches
  useEffect(() => {
    setSearch('');
    setSearchResults([]);
    setScanError('');
  }, [session.id]);

  // Debounced product search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = search.trim();
    if (!q) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProducts(q, true);
        setSearchResults(results.slice(0, 6));
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const addToCart = useCallback(async (r: ProductSearchResult) => {
    setSearch('');
    setSearchResults([]);
    setScanError('');

    const existing = session.items.findIndex(i => i.variantId === r.variantId);
    const qtyAlreadyInCart = existing >= 0 ? session.items[existing].qty : 0;

    // Belt-and-suspenders stock check — the product search already filters to in-stock items,
    // but barcode scan/typed-barcode entry deliberately bypasses that filter (a cashier
    // scanning a real shelf item shouldn't get a confusing "not found"). This is the one place
    // every entry path funnels through, so it's the right spot to catch a zero-stock item
    // regardless of how it was added, and to stop a re-scan from pushing qty past what's on hand.
    if (r.stock <= qtyAlreadyInCart) {
      setScanError(`Out of stock: ${r.productName}${r.variantSku ? ` (${r.variantSku})` : ''}`);
      return;
    }

    const newItems: PosCartItem[] = [...session.items];

    if (existing >= 0) {
      newItems[existing] = { ...newItems[existing], qty: newItems[existing].qty + 1 };
    } else {
      newItems.push({
        variantId: r.variantId,
        productName: r.productName,
        variantLabel: parseVariantLabel(r.variantValuesJson),
        sku: r.variantSku,
        unitPrice: r.sellingPrice,
        qty: 1,
        available: r.stock,
      });
    }

    await posDb.sessions.update(session.id, { items: newItems, updatedAt: Date.now() });
    searchRef.current?.focus();
  }, [session.id, session.items]);

  const handleBarcodeInput = useCallback(async (barcode: string) => {
    setScanError('');
    try {
      const r = await lookupBarcode(barcode);
      await addToCart(r);
    } catch {
      setScanError(`Not found: ${barcode}`);
    }
  }, [addToCart]);

  // Enter key in search bar: try barcode first, then first search result
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    e.preventDefault();
    try {
      const r = await lookupBarcode(search.trim());
      await addToCart(r);
      return;
    } catch { /* not a barcode */ }
    if (searchResults.length > 0) {
      await addToCart(searchResults[0]);
    }
  };

  const updateQty = async (variantId: string, delta: number) => {
    const newItems = session.items
      .map(i => i.variantId === variantId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0);
    await posDb.sessions.update(session.id, { items: newItems, updatedAt: Date.now() });
  };

  const removeItem = async (variantId: string) => {
    const newItems = session.items.filter(i => i.variantId !== variantId);
    await posDb.sessions.update(session.id, { items: newItems, updatedAt: Date.now() });
  };

  const handleCustomerSelect = async (c: SelectedCustomer) => {
    setCustomerPickerOpen(false);
    await posDb.sessions.update(session.id, {
      customerName: c.name,
      customerPhone: c.phone,
      customerId: c.id,
      updatedAt: Date.now(),
    });
  };

  const clearCustomer = async () => {
    await posDb.sessions.update(session.id, {
      customerName: '',
      customerPhone: '',
      customerId: undefined,
      updatedAt: Date.now(),
    });
  };

  const handleDiscountChange = async (
    type: 'PERCENT' | 'FIXED' | undefined,
    value: number | undefined
  ) => {
    await posDb.sessions.update(session.id, {
      discountType: type,
      discountValue: value,
      updatedAt: Date.now(),
    });
  };

  const subtotal = sessionSubtotal(session);
  const discount = calcDiscount(session);
  const total = subtotal - discount;
  const isEmpty = session.items.length === 0;
  const itemCount = session.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">

      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 shrink-0 bg-gray-50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search product or scan barcode…"
              className="w-full pl-3 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoComplete="off"
              autoCorrect="off"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSearchResults([]); setScanError(''); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setScanError(''); setShowScanner(true); }}
            className="flex-shrink-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            title="Camera scan"
          >
            <QrCodeIcon className="w-5 h-5" />
          </button>
        </div>

        {scanError && (
          <p className="mt-1.5 text-xs text-red-500 px-1">{scanError}</p>
        )}

        {/* Inline search results */}
        {(searchResults.length > 0 || (searching && search)) && (
          <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {searching && (
              <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
            )}
            {searchResults.map(r => (
              <button
                key={r.variantId}
                onClick={() => addToCart(r)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.productName}</p>
                  <p className="text-xs text-gray-400">
                    {parseVariantLabel(r.variantValuesJson) || r.variantSku}
                    {' · '}Stock: {r.stock}
                  </p>
                </div>
                <span className="text-sm font-semibold text-indigo-600 ml-3 shrink-0">
                  ৳{r.sellingPrice.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-2">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2 select-none">
            <QrCodeIcon className="w-10 h-10" />
            <p className="text-sm">Scan or search a product</p>
          </div>
        ) : (
          session.items.map(item => (
            <div
              key={item.variantId}
              className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-tight truncate">
                  {item.productName}
                </p>
                {item.variantLabel && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.variantLabel}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  ৳{item.unitPrice.toLocaleString()} each
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => updateQty(item.variantId, -1)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-semibold text-gray-900 tabular-nums">
                  {item.qty}
                </span>
                <button
                  onClick={() => updateQty(item.variantId, 1)}
                  className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-200 transition-colors active:scale-95"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
                <span className="w-16 text-right text-sm font-semibold text-gray-900 tabular-nums">
                  ৳{(item.unitPrice * item.qty).toLocaleString()}
                </span>
                <button
                  onClick={() => removeItem(item.variantId)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom bar: customer + discount + totals + pay */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-3 pt-3 pb-4 space-y-2.5">

        {/* Customer */}
        {session.customerName ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
            <UserCircleIcon className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-indigo-700 truncate">{session.customerName}</p>
              <p className="text-xs text-indigo-400">{session.customerPhone}</p>
            </div>
            <button onClick={clearCustomer} className="text-indigo-300 hover:text-indigo-500">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCustomerPickerOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
          >
            <UserCircleIcon className="w-4 h-4 shrink-0" />
            <span>Add customer (optional)</span>
          </button>
        )}

        {/* Discount */}
        {!showDiscount ? (
          <button
            onClick={() => setShowDiscount(true)}
            className="text-xs text-indigo-500 hover:underline px-1"
          >
            + Add discount
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <select
              value={session.discountType ?? 'PERCENT'}
              onChange={e =>
                handleDiscountChange(
                  e.target.value as 'PERCENT' | 'FIXED',
                  session.discountValue
                )
              }
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white"
            >
              <option value="PERCENT">% Off</option>
              <option value="FIXED">৳ Off</option>
            </select>
            <input
              type="number"
              min="0"
              value={session.discountValue ?? ''}
              onChange={e =>
                handleDiscountChange(
                  session.discountType ?? 'PERCENT',
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              placeholder="0"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <button
              onClick={() => {
                setShowDiscount(false);
                handleDiscountChange(undefined, undefined);
              }}
              className="text-gray-400 hover:text-red-400 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Totals */}
        {!isEmpty && (
          <div className="space-y-1 px-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
              <span>৳{subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>− ৳{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
              <span>Total</span>
              <span className="tabular-nums">৳{total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={onPayClick}
          disabled={isEmpty}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:bg-indigo-700 transition-colors"
        >
          {isEmpty ? 'Add items to pay' : `Pay ৳${total.toLocaleString()}`}
        </button>
      </div>

      {/* Camera barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onScan={async (barcode) => { setShowScanner(false); await handleBarcodeInput(barcode); }}
          onClose={() => setShowScanner(false)}
          errorMessage={scanError}
        />
      )}

      {/* Customer picker slide panel */}
      <CustomerPickerSlide
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={handleCustomerSelect}
        selectedPhone={session.customerPhone || undefined}
      />
    </div>
  );
}
