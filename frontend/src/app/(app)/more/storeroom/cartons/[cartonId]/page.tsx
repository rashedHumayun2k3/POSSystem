'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCarton, openCarton, labelCartonItem, updateCarton } from '@/lib/cartonApi';
import type { ProductSearchResult } from '@/types/catalog';
import type { CartonItem } from '@/types/carton';
import { useLanguage } from '@/i18n/LanguageContext';
import ProductPicker from '@/components/purchases/ProductPicker';

type Panel = null | 'open' | 'label' | 'edit';

interface OpenItemRow {
  variantId: string;
  productName: string;
  variantLabel: string;
  qty: string;
  damaged: string;
  price: string;
}

const STATUS_COLOR: Record<string, string> = {
  SEALED:  'bg-blue-100 text-blue-700',
  OPENED:  'bg-yellow-100 text-yellow-700',
  PARTIAL: 'bg-orange-100 text-orange-700',
  DONE:    'bg-green-100 text-green-700',
};

export default function CartonDetailPage() {
  const { cartonId } = useParams<{ cartonId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [panel, setPanel] = useState<Panel>(null);
  const [selectedItem, setSelectedItem] = useState<CartonItem | null>(null);
  const [labelQty, setLabelQty] = useState('');
  const [openItems, setOpenItems] = useState<OpenItemRow[]>([]);
  const [openLocation, setOpenLocation] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: carton, isLoading } = useQuery({
    queryKey: ['carton', cartonId],
    queryFn: () => getCarton(cartonId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['carton', cartonId] });
    qc.invalidateQueries({ queryKey: ['cartons', carton?.tripId] });
    qc.invalidateQueries({ queryKey: ['storeroom-summary'] });
    qc.invalidateQueries({ queryKey: ['trips-with-cartons'] });
  };

  const openMutation = useMutation({
    mutationFn: () => openCarton(cartonId, {
      location: openLocation || undefined,
      notes: openNotes || undefined,
      items: openItems.map(i => ({
        variantId: i.variantId,
        qtyInCarton: parseFloat(i.qty) || 0,
        qtyDamaged: parseFloat(i.damaged) || 0,
        labelPrice: parseFloat(i.price) || 0,
      })),
    }),
    onSuccess: () => { invalidate(); setPanel(null); setOpenItems([]); },
  });

  const labelMutation = useMutation({
    mutationFn: () => labelCartonItem(cartonId, selectedItem!.id, parseFloat(labelQty) || 0),
    onSuccess: () => { invalidate(); setPanel(null); setLabelQty(''); setSelectedItem(null); },
  });

  const editMutation = useMutation({
    mutationFn: () => updateCarton(cartonId, { location: editLocation, notes: editNotes }),
    onSuccess: () => { invalidate(); setPanel(null); },
  });

  function openEditPanel() {
    setEditLocation(carton?.location ?? '');
    setEditNotes(carton?.notes ?? '');
    setPanel('edit');
  }

  function openOpenPanel() {
    setOpenLocation(carton?.location ?? '');
    setOpenNotes(carton?.notes ?? '');
    setOpenItems(carton?.items.map(i => ({
      variantId: i.variantId,
      productName: i.productName,
      variantLabel: parseVariantLabel(i.variantValues),
      qty: String(i.qtyInCarton),
      damaged: String(i.qtyDamaged),
      price: String(i.labelPrice),
    })) ?? []);
    setPanel('open');
  }

  function addProductToOpen(r: ProductSearchResult) {
    if (openItems.some(i => i.variantId === r.variantId)) return;
    setOpenItems(prev => [...prev, {
      variantId: r.variantId,
      productName: r.productName,
      variantLabel: parseVariantLabel(r.variantValuesJson),
      qty: '',
      damaged: '0',
      price: String(r.sellingPrice),
    }]);
    setPickerOpen(false);
  }

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}...</div>;
  if (!carton) return <div className="p-8 text-center text-sm text-gray-400">Not found</div>;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{carton.cartonNo}</h1>
        <button onClick={openEditPanel} className="text-sm text-gray-500">{t('settings.edit')}</button>
      </div>

      {/* Carton info */}
      <div className="px-4 pt-4 space-y-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_COLOR[carton.status]}`}>{carton.status}</span>
            <span className="text-xs text-gray-400">{t('storeroom.tripLabel')}: {carton.tripNo}</span>
          </div>
          {carton.location && <p className="text-sm text-gray-600">📍 {carton.location}</p>}
          {carton.notes && <p className="text-sm text-gray-400 italic">{carton.notes}</p>}
          {carton.openedAt && (
            <p className="text-xs text-gray-400">{t('storeroom.openedAt')}: {new Date(carton.openedAt).toLocaleDateString()}</p>
          )}
        </div>

        {/* Action buttons */}
        {carton.status === 'SEALED' && (
          <button onClick={openOpenPanel}
            className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm">
            📦 {t('storeroom.openCarton')}
          </button>
        )}

        {(carton.status === 'OPENED' || carton.status === 'PARTIAL') && (
          <button onClick={openOpenPanel}
            className="w-full h-11 rounded-xl border border-indigo-300 text-indigo-600 font-semibold text-sm">
            ✏️ {t('storeroom.editContents')}
          </button>
        )}

        {/* Contents */}
        {carton.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('storeroom.contents')}</p>
            <div className="space-y-2">
              {carton.items.map(item => (
                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400">{item.variantSku} {parseVariantLabel(item.variantValues) && `· ${parseVariantLabel(item.variantValues)}`}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="text-gray-600">{item.qtyInCarton} {t('storeroom.pcs')}</span>
                        {item.qtyLabeled > 0 && <span className="text-green-600">✓ {item.qtyLabeled} {t('storeroom.labeled')}</span>}
                        {item.qtyDamaged > 0 && <span className="text-red-500">⚠ {item.qtyDamaged} {t('storeroom.damaged')}</span>}
                        {item.qtyRemaining > 0 && <span className="text-orange-500">{item.qtyRemaining} {t('storeroom.remaining')}</span>}
                      </div>
                      <p className="text-xs text-indigo-600 mt-0.5">৳{item.labelPrice.toLocaleString()} / {t('storeroom.pcs')}</p>
                    </div>
                    {item.qtyRemaining > 0 && (
                      <div className="flex flex-col gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => { setSelectedItem(item); setLabelQty(String(item.qtyRemaining)); setPanel('label'); }}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium">
                          🏷 {t('storeroom.label')}
                        </button>
                        <Link href={`/more/storeroom/cartons/${cartonId}/print?itemId=${item.id}`}
                          className="text-xs border border-indigo-300 text-indigo-600 px-3 py-1.5 rounded-lg font-medium text-center">
                          🖨 {t('storeroom.print')}
                        </Link>
                      </div>
                    )}
                    {item.qtyRemaining === 0 && item.qtyLabeled > 0 && (
                      <Link href={`/more/storeroom/cartons/${cartonId}/print?itemId=${item.id}`}
                        className="ml-2 shrink-0 text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg">
                        🖨 {t('storeroom.reprint')}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Open Carton Panel ─────────────────────────────────────────────── */}
      {panel === 'open' && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('storeroom.openCarton')}</h2>
              <button onClick={() => setPanel(null)} className="text-gray-400">✕</button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Location + notes */}
              <input placeholder={t('storeroom.locationPlaceholder')} value={openLocation} onChange={e => setOpenLocation(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <input placeholder={t('storeroom.notesPlaceholder')} value={openNotes} onChange={e => setOpenNotes(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />

              {/* Product picker */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">{t('storeroom.whatsInside')}</p>
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="w-full h-10 px-3 rounded-xl border border-dashed border-indigo-300 text-sm text-indigo-600 font-medium text-left">
                  + {t('storeroom.searchProduct')}
                </button>
              </div>

              {/* Item rows */}
              {openItems.map((row, idx) => (
                <div key={row.variantId} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{row.productName}</p>
                    <button onClick={() => setOpenItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 text-lg">✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">{t('storeroom.qty')}</p>
                      <input type="number" inputMode="decimal" value={row.qty}
                        onChange={e => setOpenItems(prev => prev.map((r, i) => i === idx ? { ...r, qty: e.target.value } : r))}
                        className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm text-center" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">{t('storeroom.damaged')}</p>
                      <input type="number" inputMode="decimal" value={row.damaged}
                        onChange={e => setOpenItems(prev => prev.map((r, i) => i === idx ? { ...r, damaged: e.target.value } : r))}
                        className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm text-center" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">{t('storeroom.priceLabel')}</p>
                      <input type="number" inputMode="decimal" value={row.price}
                        onChange={e => setOpenItems(prev => prev.map((r, i) => i === idx ? { ...r, price: e.target.value } : r))}
                        className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm text-center" />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={() => openMutation.mutate()} disabled={openMutation.isPending || openItems.length === 0}
                className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">
                {openMutation.isPending ? t('common.saving') : t('storeroom.saveContents')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Label Panel ───────────────────────────────────────────────────── */}
      {panel === 'label' && selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="bg-white rounded-t-3xl px-4 pt-4 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('storeroom.recordLabeling')}</h2>
              <button onClick={() => setPanel(null)} className="text-gray-400">✕</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-gray-900">{selectedItem.productName}</p>
              <p className="text-xs text-gray-500">{selectedItem.variantSku}</p>
              <p className="text-xs text-indigo-600">৳{selectedItem.labelPrice} / {t('storeroom.pcs')} · {selectedItem.qtyRemaining} {t('storeroom.remaining')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">{t('storeroom.qtyLabeledNow')}</p>
              <input type="number" inputMode="decimal" value={labelQty} onChange={e => setLabelQty(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-gray-200 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="flex gap-2">
              <Link href={`/more/storeroom/cartons/${cartonId}/print?itemId=${selectedItem.id}&qty=${labelQty || selectedItem.qtyRemaining}`}
                className="flex-1 h-12 rounded-xl border border-indigo-300 text-indigo-600 font-semibold text-sm flex items-center justify-center gap-1">
                🖨 {t('storeroom.printFirst')}
              </Link>
              <button onClick={() => labelMutation.mutate()} disabled={labelMutation.isPending || !labelQty}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">
                {labelMutation.isPending ? t('common.saving') : `✓ ${t('storeroom.markLabeled')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Panel ────────────────────────────────────────────────────── */}
      {panel === 'edit' && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="bg-white rounded-t-3xl px-4 pt-4 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('settings.edit')}</h2>
              <button onClick={() => setPanel(null)} className="text-gray-400">✕</button>
            </div>
            <input placeholder={t('storeroom.locationPlaceholder')} value={editLocation} onChange={e => setEditLocation(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input placeholder={t('storeroom.notesPlaceholder')} value={editNotes} onChange={e => setEditNotes(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">
              {editMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addProductToOpen}
      />
    </div>
  );
}

function parseVariantLabel(json: string): string {
  try {
    const obj = JSON.parse(json);
    return Object.values(obj).join(' / ');
  } catch {
    return '';
  }
}
