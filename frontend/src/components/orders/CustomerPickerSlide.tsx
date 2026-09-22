'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import { searchCustomersWithFallback } from '@/lib/localDb/catalogCache';
import type { CustomerSummary } from '@/types/orders';
import { useLanguage } from '@/i18n/LanguageContext';

export interface SelectedCustomer {
  id?: string;
  name: string;
  phone: string;
  address: string;
  isNew: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: SelectedCustomer) => void;
  selectedPhone?: string;
}

export default function CustomerPickerSlide({ open, onClose, onSelect, selectedPhone }: Props) {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', address: '' });
  const { t } = useLanguage();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['customer-search', search],
    queryFn: () => searchCustomersWithFallback(search),
    enabled: open && search.trim().length >= 1,
    staleTime: 3000,
  });

  const handleSelect = (c: CustomerSummary) => {
    onSelect({ id: c.id, name: c.name, phone: c.phone, address: c.address ?? '', isNew: false });
    doClose();
  };

  const handleAddSave = () => {
    if (!addForm.name.trim() || !addForm.phone.trim() || !addForm.address.trim()) return;
    onSelect({ name: addForm.name.trim(), phone: addForm.phone.trim(), address: addForm.address.trim(), isNew: true });
    doClose();
  };

  const doClose = () => {
    onClose();
    setSearch('');
    setShowAddForm(false);
    setAddForm({ name: '', phone: '', address: '' });
  };

  const showResults = search.trim().length >= 1;

  const openAddForm = () => {
    setShowAddForm(true);
    if (/^\d+$/.test(search)) {
      setAddForm((f) => ({ ...f, phone: search }));
    } else {
      setAddForm((f) => ({ ...f, name: search }));
    }
  };

  return (
    <SlidePanel open={open} onClose={doClose} title={t('orders.selectCustomer')}>
      {/* Search input */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder={t('orders.searchByPhoneOrName')}
          value={search}
          inputMode="text"
          autoFocus={open}
          onChange={(e) => { setSearch(e.target.value); setShowAddForm(false); }}
        />
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {showResults && isFetching && (
          <p className="text-center text-sm text-gray-400 py-8">{t('orders.lookingUp')}</p>
        )}

        {showResults && !isFetching && results.map((c) => (
          <CustomerRow key={c.id} customer={c} selected={c.phone === selectedPhone} onSelect={handleSelect} />
        ))}

        {showResults && !isFetching && results.length === 0 && !showAddForm && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 mb-1">{t('orders.noCustomersFound')}</p>
            <p className="text-xs text-gray-300">{t('orders.addCustomerHint')}</p>
          </div>
        )}

        {!showResults && (
          <p className="text-center text-sm text-gray-300 py-12 px-6">{t('orders.searchByPhoneOrName')}</p>
        )}
      </div>

      {/* Add new customer footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        {showAddForm ? (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-gray-800">{t('orders.newCustomerTitle')}</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder={`${t('orders.customerName')} *`}
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder={`${t('orders.customerPhone')} *`}
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder={`${t('orders.customerAddress')} *`}
              rows={2}
              value={addForm.address}
              onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddSave}
                disabled={!addForm.name.trim() || !addForm.phone.trim() || !addForm.address.trim()}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {t('pickers.saveAndSelect')}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddForm({ name: '', phone: '', address: '' }); }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 text-indigo-600 text-sm font-medium py-1 w-full"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            {/* Keep changing text inside one element: browser translation can replace bare
                text nodes, which would make clearing the search fail during React removal. */}
            <span>{`${t('orders.addNewCustomer')}${search ? ` "${search}"` : ''}`}</span>
          </button>
        )}
      </div>
    </SlidePanel>
  );
}

function CustomerRow({
  customer,
  selected,
  onSelect,
}: {
  customer: CustomerSummary;
  selected: boolean;
  onSelect: (c: CustomerSummary) => void;
}) {
  return (
    <button
      className={`w-full text-left px-4 py-3.5 border-b border-gray-50 flex items-center gap-3 active:bg-indigo-50 transition-colors ${selected ? 'bg-indigo-50' : ''}`}
      onClick={() => onSelect(customer)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${selected ? 'text-indigo-700' : 'text-gray-900'}`}>
            {customer.name}
          </p>
          {customer.orderCount > 0 && (
            <span className="shrink-0 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
              {customer.orderCount}x
            </span>
          )}
          {customer.isSerialRejecter && (
            <span className="shrink-0 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
              ⚠ Reject
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{customer.phone}</p>
        {customer.address && (
          <p className="text-xs text-gray-400 truncate mt-0.5">📍 {customer.address}</p>
        )}
        {customer.unpaidBalance > 0 && (
          <p className="text-xs text-amber-600 mt-0.5">বাকি ৳{customer.unpaidBalance.toFixed(0)}</p>
        )}
      </div>
      {selected && (
        <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
