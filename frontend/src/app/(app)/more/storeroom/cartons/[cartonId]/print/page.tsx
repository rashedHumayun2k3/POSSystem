'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCarton } from '@/lib/cartonApi';
import type { CartonItem } from '@/types/carton';
import { useLanguage } from '@/i18n/LanguageContext';

export default function PrintLabelsPage() {
  const { cartonId } = useParams<{ cartonId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const itemId = searchParams.get('itemId');
  const qtyParam = searchParams.get('qty');

  const { data: carton, isLoading } = useQuery({
    queryKey: ['carton', cartonId],
    queryFn: () => getCarton(cartonId),
  });

  const item = carton?.items.find(i => i.id === itemId) ?? null;
  const defaultQty = qtyParam ? parseInt(qtyParam) : (item?.qtyRemaining ?? 1);
  const [printQty, setPrintQty] = useState(defaultQty);

  useEffect(() => {
    if (item && !qtyParam) setPrintQty(Math.max(1, item.qtyRemaining));
  }, [item, qtyParam]);

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}...</div>;
  if (!carton || !item) return <div className="p-8 text-center text-sm text-gray-400">Item not found</div>;

  const variantLabel = parseVariantLabel(item.variantValues);
  const labels = Array.from({ length: Math.max(1, printQty) });

  return (
    <>
      {/* Screen controls — hidden when printing */}
      <div className="print:hidden">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-base font-semibold text-gray-900">{t('storeroom.printLabels')}</h1>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Product info */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
            <p className="text-base font-bold text-gray-900">{item.productName}</p>
            {variantLabel && <p className="text-sm text-gray-500">{variantLabel}</p>}
            <p className="text-sm text-gray-400">{item.variantSku}</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">৳{item.labelPrice.toLocaleString()}</p>
          </div>

          {/* Qty selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('storeroom.labelQty')}</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setPrintQty(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border border-gray-200 text-xl text-gray-600 flex items-center justify-center">−</button>
              <input type="number" inputMode="numeric" min="1" value={printQty}
                onChange={e => setPrintQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 h-12 text-center text-xl font-bold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button onClick={() => setPrintQty(q => q + 1)}
                className="w-10 h-10 rounded-full border border-gray-200 text-xl text-gray-600 flex items-center justify-center">+</button>
            </div>
            {item.qtyRemaining > 0 && (
              <button onClick={() => setPrintQty(item.qtyRemaining)}
                className="mt-1 text-xs text-indigo-500">
                {t('storeroom.useRemaining')} ({item.qtyRemaining})
              </button>
            )}
          </div>

          {/* Barcode preview */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('storeroom.labelPreview')}</p>
            <LabelPreview item={item} variantLabel={variantLabel} cartonNo={carton.cartonNo} />
          </div>

          <button onClick={() => window.print()}
            className="w-full h-13 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-base">
            🖨 {t('storeroom.print')} {printQty} {t('storeroom.labels')}
          </button>
        </div>
      </div>

      {/* Print sheet — shown only when printing */}
      <div className="hidden print:block">
        <style>{`
          @page { size: A4; margin: 8mm; }
          body { margin: 0; }
          .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
          .label { border: 1px solid #ddd; border-radius: 4px; padding: 4mm; text-align: center; page-break-inside: avoid; font-family: sans-serif; }
          .label-product { font-size: 10pt; font-weight: bold; margin-bottom: 1mm; line-height: 1.2; }
          .label-variant { font-size: 8pt; color: #555; margin-bottom: 2mm; }
          .label-barcode { font-family: 'Libre Barcode 128', 'Courier New', monospace; font-size: 28pt; letter-spacing: 1px; line-height: 1; margin: 2mm 0; }
          .label-sku { font-size: 7pt; color: #777; margin-bottom: 2mm; }
          .label-price { font-size: 16pt; font-weight: bold; color: #000; }
          .label-carton { font-size: 7pt; color: #999; margin-top: 1mm; }
        `}</style>
        <div className="label-grid">
          {labels.map((_, i) => (
            <div key={i} className="label">
              <div className="label-product">{item.productName}</div>
              {variantLabel && <div className="label-variant">{variantLabel}</div>}
              <div className="label-barcode">{item.barcode || item.variantSku}</div>
              <div className="label-sku">{item.barcode || item.variantSku}</div>
              <div className="label-price">৳{item.labelPrice.toLocaleString()}</div>
              <div className="label-carton">{carton.cartonNo}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LabelPreview({ item, variantLabel, cartonNo }: { item: CartonItem; variantLabel: string; cartonNo: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 text-center bg-white max-w-[200px] mx-auto">
      <p className="text-xs font-bold text-gray-900 leading-tight">{item.productName}</p>
      {variantLabel && <p className="text-[10px] text-gray-500 mt-0.5">{variantLabel}</p>}
      <div className="my-2 font-mono text-2xl tracking-widest text-gray-800 leading-none overflow-hidden">
        {(item.barcode || item.variantSku).substring(0, 10)}
      </div>
      <p className="text-[9px] text-gray-400">{item.barcode || item.variantSku}</p>
      <p className="text-xl font-bold text-black mt-1">৳{item.labelPrice.toLocaleString()}</p>
      <p className="text-[8px] text-gray-300 mt-1">{cartonNo}</p>
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
