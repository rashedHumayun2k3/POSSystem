'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import { listSuppliers, createSupplier } from '@/lib/suppliersApi';
import type { SupplierDto } from '@/types/supplier';
import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (supplier: SupplierDto) => void;
  selectedId?: string | null;
}

export default function SupplierPicker({ open, onClose, onSelect, selectedId }: Props) {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', address: '' });
  const [addError, setAddError] = useState('');
  const { t } = useLanguage();

  const qc = useQueryClient();

  const { data: allSuppliers = [] } = useQuery({
    queryKey: ['suppliers', 'list', search],
    queryFn: () => listSuppliers(search ? { search } : undefined),
    enabled: open,
  });

  const { data: recentSuppliers = [] } = useQuery({
    queryKey: ['suppliers', 'recent'],
    queryFn: () => listSuppliers({ sort: 'recent', limit: 5 }),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: (supplier) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowAddForm(false);
      setAddForm({ name: '', phone: '', address: '' });
      setAddError('');
      handleSelect(supplier);
    },
    onError: () => setAddError(t('pickers.failedSaveSupplier')),
  });

  const handleSelect = (supplier: SupplierDto) => {
    onSelect(supplier);
    onClose();
    setSearch('');
  };

  const handleClose = () => {
    onClose();
    setSearch('');
    setShowAddForm(false);
    setAddError('');
  };

  // Build A-Z grouped list; when searching show flat list, when not searching hide recent dupes
  const recentIds = new Set(recentSuppliers.map((s) => s.id));
  const grouped: Record<string, SupplierDto[]> = {};

  for (const s of allSuppliers) {
    if (!search && recentIds.has(s.id)) continue; // already shown in recent
    const letter = s.name[0]?.toUpperCase() ?? '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(s);
  }
  const letters = Object.keys(grouped).sort();

  return (
    <SlidePanel open={open} onClose={handleClose} title={t('pickers.chooseSupplier')}>
      {/* Search box */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder={t('pickers.searchSupplier')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowAddForm(false); }}
          autoFocus
        />
      </div>

      {/* Recent — shown only when not searching */}
      {!search && recentSuppliers.length > 0 && (
        <div>
          <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
            {t('pickers.recent')}
          </p>
          {recentSuppliers.map((s) => (
            <SupplierRow key={s.id} supplier={s} selected={s.id === selectedId} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {/* A-Z grouped */}
      {letters.map((letter) => (
        <div key={letter}>
          <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
            {letter}
          </p>
          {grouped[letter].map((s) => (
            <SupplierRow key={s.id} supplier={s} selected={s.id === selectedId} onSelect={handleSelect} />
          ))}
        </div>
      ))}

      {allSuppliers.length === 0 && !showAddForm && (
        <p className="text-center text-sm text-gray-400 py-8">
          {search ? t('pickers.noSuppliersFound') : t('pickers.noSuppliersYet')}
        </p>
      )}

      {/* Add new supplier */}
      <div className="px-4 py-3 border-t border-gray-100 mt-1">
        {showAddForm ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">{t('pickers.newSupplier')}</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder={t('pickers.namePlaceholder')}
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder={t('pickers.phonePlaceholder')}
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder={t('pickers.addressPlaceholder')}
              value={addForm.address}
              onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
            />
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  createMutation.mutate({
                    name: addForm.name.trim(),
                    phone: addForm.phone.trim() || undefined,
                    address: addForm.address.trim() || undefined,
                  })
                }
                disabled={!addForm.name.trim() || createMutation.isPending}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {createMutation.isPending ? t('common.saving') : t('pickers.saveAndSelect')}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddForm({ name: '', phone: '', address: '' }); setAddError(''); }}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowAddForm(true);
              setAddForm((f) => ({ ...f, name: search }));
            }}
            className="flex items-center gap-2 text-indigo-600 text-sm font-medium py-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('pickers.addNewSupplier')}{search ? ` "${search}"` : ''}
          </button>
        )}
      </div>
    </SlidePanel>
  );
}

function SupplierRow({
  supplier,
  selected,
  onSelect,
}: {
  supplier: SupplierDto;
  selected: boolean;
  onSelect: (s: SupplierDto) => void;
}) {
  return (
    <button
      className={`w-full text-left px-4 py-3 border-b border-gray-50 flex items-center gap-3 active:bg-indigo-50 transition-colors ${
        selected ? 'bg-indigo-50' : ''
      }`}
      onClick={() => onSelect(supplier)}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${selected ? 'text-indigo-700' : 'text-gray-900'}`}>
          {supplier.name}
        </p>
        {supplier.address && (
          <p className="text-xs text-gray-400 truncate">📍 {supplier.address}</p>
        )}
        {supplier.phone && <p className="text-xs text-gray-400">{supplier.phone}</p>}
      </div>
      {selected && (
        <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
