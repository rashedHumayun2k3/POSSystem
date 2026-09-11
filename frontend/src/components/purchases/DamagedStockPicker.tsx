'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import { listDamagedStock } from '@/lib/supplierReturnsApi';
import type { DamagedStockItem } from '@/types/supplierReturns';
import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: DamagedStockItem) => void;
  branchId?: string | null;
}

// Scoped picker for the supplier-return "Add Item" flow — unlike the general ProductPicker
// (full catalog, search/barcode/categories), this only ever lists variants that currently have
// unclaimed Damaged stock, since that's the only thing a return can legally contain.
export default function DamagedStockPicker({ open, onClose, onSelect, branchId }: Props) {
  const [search, setSearch] = useState('');
  const { t } = useLanguage();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['damaged-stock', branchId, search],
    queryFn: () => listDamagedStock(branchId ?? undefined, search || undefined),
    enabled: open,
  });

  const handleSelect = (item: DamagedStockItem) => {
    onSelect(item);
    onClose();
    setSearch('');
  };

  const handleClose = () => {
    onClose();
    setSearch('');
  };

  return (
    <SlidePanel open={open} onClose={handleClose} title={t('supplierReturns.pickDamagedItem')}>
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-400"
          placeholder={t('purchases.searchProduct')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-8">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">{t('supplierReturns.noDamagedStock')}</p>
      ) : (
        items.map((item) => (
          <button
            key={item.variantId}
            type="button"
            className="w-full text-left px-4 py-3 border-b border-gray-50 flex items-center gap-3 active:bg-rose-50 transition-colors"
            onClick={() => handleSelect(item)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
              <p className="text-xs text-gray-400">{item.variantSku}</p>
            </div>
            <span className="text-xs font-semibold text-rose-600 shrink-0">{item.damagedQty} {item.unitCode}</span>
          </button>
        ))
      )}
    </SlidePanel>
  );
}
