'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownTrayIcon, ArrowPathIcon, EnvelopeIcon, MagnifyingGlassIcon, PrinterIcon, ShareIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { browseProducts, createBarcodeLabelBatchPdf, sendBarcodeLabelBatchPdf, type BarcodeLabelBatchPayload } from '@/lib/catalogApi';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import type { ProductSearchResult } from '@/types/catalog';
import BarcodeLabel from '@/components/barcode/BarcodeLabel';
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  FOUR_COLUMN_STARTER,
  MAX_LABEL_QUANTITY,
  MAX_TOTAL_LABELS,
  expandLabels,
  paginateA4,
  validateA4Template,
  validateBarcode,
  validateRollSize,
  type A4Template,
  type LabelItem,
  type LabelSelection,
  type RollSize,
} from '@/lib/barcodeLabels';

type PrintMode = 'a4' | 'roll';
type RollPreset = '45x25' | '50x30' | 'custom';

const fieldClass = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function ProductBarcodePage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<PrintMode>('a4');
  const [search, setSearch] = useState('');
  const [selections, setSelections] = useState<Record<string, LabelSelection>>({});
  const [template, setTemplate] = useState<A4Template>(FOUR_COLUMN_STARTER);
  const [startPosition, setStartPosition] = useState(1);
  const [rollPreset, setRollPreset] = useState<RollPreset>('45x25');
  const [customRollSize, setCustomRollSize] = useState<RollSize>({ width: 45, height: 25 });
  const [printError, setPrintError] = useState('');
  const accountEmail = useAuthStore((state) => state.user?.email ?? '');
  const [exportOpen, setExportOpen] = useState(false);
  const [email, setEmail] = useState(accountEmail);
  const [exportBusy, setExportBusy] = useState<'share' | 'download' | 'email' | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['barcode-label-products'],
    queryFn: () => browseProducts(),
  });

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.productName, product.variantSku, product.barcode].some((value) => value?.toLocaleLowerCase().includes(query))
    );
  }, [products, search]);

  const selected = Object.values(selections);
  const labels = useMemo(() => expandLabels(selected), [selected]);
  const totalLabels = labels.length;
  const positionsPerPage = template.columns * template.rows;
  const a4Pages = useMemo(
    () => paginateA4(labels, startPosition, positionsPerPage),
    [labels, startPosition, positionsPerPage]
  );
  const rollSize = rollPreset === '45x25'
    ? { width: 45, height: 25 }
    : rollPreset === '50x30'
      ? { width: 50, height: 30 }
      : customRollSize;
  const templateErrors = validateA4Template(template);
  const rollErrors = validateRollSize(rollSize);
  const selectionErrors = selected.flatMap((item) => {
    const barcodeError = validateBarcode(item.barcode);
    const quantityError = !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LABEL_QUANTITY
      ? `${item.productName}: quantity must be 1-${MAX_LABEL_QUANTITY}.`
      : null;
    return [barcodeError ? `${item.productName}: ${barcodeError}` : null, quantityError].filter((value): value is string => Boolean(value));
  });
  const validationErrors = [
    ...(totalLabels === 0 ? [t('barcodes.selectAtLeastOne')] : []),
    ...(totalLabels > MAX_TOTAL_LABELS ? [t('barcodes.tooManyLabels', { max: MAX_TOTAL_LABELS })] : []),
    ...selectionErrors,
    ...(mode === 'a4' ? templateErrors : rollErrors),
    ...(mode === 'a4' && (startPosition < 1 || startPosition > positionsPerPage)
      ? [t('barcodes.invalidStartPosition', { max: positionsPerPage })]
      : []),
  ];

  function toggleProduct(product: ProductSearchResult) {
    setSelections((current) => {
      const next = { ...current };
      if (next[product.variantId]) delete next[product.variantId];
      else next[product.variantId] = { ...product, quantity: 1 };
      return next;
    });
    setPrintError('');
  }

  function setQuantity(variantId: string, rawValue: string) {
    const parsed = Number(rawValue);
    setSelections((current) => ({
      ...current,
      [variantId]: {
        ...current[variantId],
        quantity: Number.isFinite(parsed) ? Math.trunc(parsed) : 0,
      },
    }));
  }

  function updateTemplate<K extends keyof A4Template>(key: K, rawValue: string) {
    const parsed = Number(rawValue);
    setTemplate((current) => ({ ...current, [key]: parsed }));
  }

  function print() {
    if (validationErrors.length > 0) {
      setPrintError(validationErrors[0]);
      return;
    }
    setPrintError('');
    window.print();
  }

  function batchPayload(): BarcodeLabelBatchPayload {
    return {
      mode: mode === 'a4' ? 'A4' : 'ROLL',
      items: selected.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      ...(mode === 'a4' ? { a4: template } : { roll: rollSize }),
      startPosition,
    };
  }

  function downloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function exportPdf(action: 'share' | 'download') {
    if (validationErrors.length > 0) { setExportError(validationErrors[0]); return; }
    setExportBusy(action);
    setExportError('');
    setExportSuccess('');
    try {
      const blob = await createBarcodeLabelBatchPdf(batchPayload());
      if (action === 'share') {
        const file = new File([blob], `barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ title: t('barcodes.pdfTitle'), text: t('barcodes.shareText'), files: [file] });
          setExportSuccess(t('barcodes.shareComplete'));
        } else {
          downloadBlob(blob);
          setExportSuccess(t('barcodes.shareFallback'));
        }
      } else {
        downloadBlob(blob);
        setExportSuccess(t('barcodes.downloadComplete'));
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') setExportError((error as Error)?.message || getErrorMessage(error, t('barcodes.pdfError')));
    } finally {
      setExportBusy(null);
    }
  }

  async function sendEmail() {
    const recipient = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { setExportError(t('barcodes.invalidEmail')); return; }
    if (validationErrors.length > 0) { setExportError(validationErrors[0]); return; }
    setExportBusy('email');
    setExportError('');
    setExportSuccess('');
    try {
      const message = await sendBarcodeLabelBatchPdf(batchPayload(), recipient);
      setExportSuccess(message || t('barcodes.emailComplete', { email: recipient }));
    } catch (error) {
      setExportError(getErrorMessage(error, t('barcodes.emailError')));
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="barcode-workspace bg-gray-50 px-4 py-5 pb-28">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <TagIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{t('barcodes.title')}</h1>
              <p className="mt-1 text-sm leading-5 text-gray-500">{t('barcodes.intro')}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeButton active={mode === 'a4'} onClick={() => setMode('a4')} title={t('barcodes.a4Button')} description={t('barcodes.a4Description')} />
          <ModeButton active={mode === 'roll'} onClick={() => setMode('roll')} title={t('barcodes.rollButton')} description={t('barcodes.rollDescription')} />
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{t('barcodes.chooseProducts')}</h2>
              <p className="text-xs text-gray-500">{t('barcodes.selectedSummary', { products: selected.length, labels: totalLabels })}</p>
            </div>
            {selected.length > 0 && <button type="button" onClick={() => setSelections({})} className="text-xs font-semibold text-red-600">{t('barcodes.clear')}</button>}
          </div>
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('barcodes.searchProducts')} className={`${fieldClass} pl-10`} />
          </div>
          <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
            {isLoading && <p className="p-6 text-center text-sm text-gray-400">{t('common.loading')}...</p>}
            {isError && (
              <div className="p-6 text-center">
                <p className="text-sm text-red-600">{t('barcodes.loadError')}</p>
                <button type="button" onClick={() => refetch()} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"><ArrowPathIcon className="h-4 w-4" />{t('common.retry')}</button>
              </div>
            )}
            {!isLoading && !isError && filteredProducts.length === 0 && <p className="p-6 text-center text-sm text-gray-400">{t('barcodes.noProducts')}</p>}
            {filteredProducts.map((product) => {
              const selection = selections[product.variantId];
              const barcodeError = validateBarcode(product.barcode);
              return (
                <div key={product.variantId} className={`flex items-center gap-3 p-3 ${selection ? 'bg-indigo-50' : 'bg-white'}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(selection)}
                    disabled={Boolean(barcodeError)}
                    onChange={() => toggleProduct(product)}
                    aria-label={product.productName}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600"
                  />
                  <button type="button" disabled={Boolean(barcodeError)} onClick={() => toggleProduct(product)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
                    <p className="truncate text-sm font-semibold text-gray-900">{product.productName}</p>
                    <p className="truncate text-xs text-gray-500">{product.variantSku} · {product.barcode || t('barcodes.missingBarcode')} · ৳{product.sellingPrice.toLocaleString()}</p>
                    {barcodeError && <p className="mt-0.5 text-xs font-medium text-red-600">{barcodeError}</p>}
                  </button>
                  {selection && (
                    <label className="shrink-0 text-xs text-gray-500">
                      {t('barcodes.quantity')}
                      <input
                        type="number"
                        min="1"
                        max={MAX_LABEL_QUANTITY}
                        value={selection.quantity}
                        onChange={(event) => setQuantity(product.variantId, event.target.value)}
                        className="ml-2 h-9 w-20 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm font-semibold"
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {mode === 'a4' ? (
          <A4Settings template={template} startPosition={startPosition} onTemplateChange={updateTemplate} onStartChange={setStartPosition} t={t} />
        ) : (
          <RollSettings preset={rollPreset} size={customRollSize} onPresetChange={setRollPreset} onSizeChange={setCustomRollSize} t={t} />
        )}

        {validationErrors.length > 0 && selected.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {validationErrors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{t('barcodes.preview')}</h2>
              <p className="text-xs text-gray-500">{t('barcodes.previewCount', { labels: totalLabels, pages: mode === 'a4' ? a4Pages.length : totalLabels })}</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">{totalLabels} {t('barcodes.labels')}</span>
          </div>
          {totalLabels === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">{t('barcodes.previewEmpty')}</div>
          ) : (
            <PrintPreview mode={mode} pages={a4Pages} labels={labels} template={template} rollSize={rollSize} />
          )}
        </section>

        <div className="sticky bottom-20 z-20 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur print:hidden">
          {printError && <p className="mb-2 text-sm font-medium text-red-600">{printError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={print} disabled={validationErrors.length > 0} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
              <PrinterIcon className="h-5 w-5" />{t('barcodes.printNow')}
            </button>
            <button type="button" onClick={() => { setExportOpen(true); setExportError(''); setExportSuccess(''); }} disabled={validationErrors.length > 0} className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3.5 text-sm font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400">
              <ShareIcon className="h-5 w-5" />{t('barcodes.exportSend')}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">{totalLabels} {t('barcodes.labels')}</p>
        </div>
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="barcode-export-title">
          <button type="button" aria-label={t('common.close')} onClick={() => setExportOpen(false)} className="absolute inset-0 cursor-default" />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="barcode-export-title" className="text-lg font-bold text-gray-900">{t('barcodes.exportTitle')}</h2><p className="mt-1 text-sm text-gray-500">{t('barcodes.exportDescription')}</p></div>
              <button type="button" onClick={() => setExportOpen(false)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={exportBusy !== null} onClick={() => exportPdf('share')} className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-700 disabled:opacity-50">
                <ShareIcon className="h-6 w-6" />{exportBusy === 'share' ? t('barcodes.preparingPdf') : t('barcodes.sharePdf')}
              </button>
              <button type="button" disabled={exportBusy !== null} onClick={() => exportPdf('download')} className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-gray-200 p-4 text-sm font-semibold text-gray-700 disabled:opacity-50">
                <ArrowDownTrayIcon className="h-6 w-6" />{exportBusy === 'download' ? t('barcodes.preparingPdf') : t('barcodes.downloadPdf')}
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />{t('barcodes.orEmail')}<span className="h-px flex-1 bg-gray-200" /></div>
            <label className="block text-xs font-semibold text-gray-600">{t('barcodes.recipientEmail')}
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="printer@example.com" className={`${fieldClass} mt-1`} />
            </label>
            <button type="button" disabled={exportBusy !== null} onClick={sendEmail} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
              <EnvelopeIcon className="h-5 w-5" />{exportBusy === 'email' ? t('barcodes.sendingEmail') : t('barcodes.sendEmail')}
            </button>
            {exportError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}
            {exportSuccess && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{exportSuccess}</p>}
            <p className="mt-3 text-xs leading-5 text-gray-400">{t('barcodes.actualSizeReminder')}</p>
          </div>
        </div>
      )}

      <PrintOutput mode={mode} pages={a4Pages} labels={labels} template={template} rollSize={rollSize} />
      <PrintStyles mode={mode} template={template} rollSize={rollSize} />
    </div>
  );
}

function ModeButton({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 font-semibold text-gray-900"><PrinterIcon className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />{title}</div>
      <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
    </button>
  );
}

function A4Settings({ template, startPosition, onTemplateChange, onStartChange, t }: {
  template: A4Template;
  startPosition: number;
  onTemplateChange: <K extends keyof A4Template>(key: K, value: string) => void;
  onStartChange: (value: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const fields: Array<[keyof A4Template, string, string]> = [
    ['labelWidth', t('barcodes.labelWidth'), '0.1'], ['labelHeight', t('barcodes.labelHeight'), '0.1'],
    ['columns', t('barcodes.columns'), '1'], ['rows', t('barcodes.rows'), '1'],
    ['horizontalGap', t('barcodes.horizontalGap'), '0.1'], ['verticalGap', t('barcodes.verticalGap'), '0.1'],
    ['marginTop', t('barcodes.marginTop'), '0.1'], ['marginRight', t('barcodes.marginRight'), '0.1'],
    ['marginBottom', t('barcodes.marginBottom'), '0.1'], ['marginLeft', t('barcodes.marginLeft'), '0.1'],
  ];
  const positions = template.columns * template.rows;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-gray-900">{t('barcodes.a4Settings')}</h2><p className="mt-1 text-xs leading-5 text-amber-700">{t('barcodes.measureWarning')}</p></div>
        <button type="button" onClick={() => Object.entries(FOUR_COLUMN_STARTER).forEach(([key, value]) => onTemplateChange(key as keyof A4Template, String(value)))} className="shrink-0 text-xs font-semibold text-indigo-600">{t('barcodes.fourColumnPreset')}</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {fields.map(([key, label, step]) => (
          <label key={key} className="text-xs font-medium text-gray-600">{label}<span className="ml-1 text-gray-400">{!['columns', 'rows'].includes(key) ? '(mm)' : ''}</span>
            <input type="number" min="0" step={step} value={template[key]} onChange={(event) => onTemplateChange(key, event.target.value)} className={`${fieldClass} mt-1`} />
          </label>
        ))}
      </div>
      <label className="mt-4 block text-xs font-medium text-gray-600">{t('barcodes.startPosition')}
        <input type="number" min="1" max={positions} value={startPosition} onChange={(event) => onStartChange(Math.trunc(Number(event.target.value)))} className={`${fieldClass} mt-1 max-w-40`} />
        <span className="mt-1 block font-normal text-gray-400">{t('barcodes.startPositionHelp', { max: positions })}</span>
      </label>
    </section>
  );
}

function RollSettings({ preset, size, onPresetChange, onSizeChange, t }: {
  preset: RollPreset; size: RollSize; onPresetChange: (preset: RollPreset) => void; onSizeChange: (size: RollSize) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-gray-900">{t('barcodes.rollSettings')}</h2>
      <p className="mt-1 text-xs leading-5 text-amber-700">{t('barcodes.rollWarning')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['45x25', '50x30', 'custom'] as RollPreset[]).map((value) => (
          <button key={value} type="button" onClick={() => onPresetChange(value)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${preset === value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
            {value === 'custom' ? t('barcodes.customSize') : `${value.replace('x', ' × ')} mm`}
          </button>
        ))}
      </div>
      {preset === 'custom' && <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-600">{t('barcodes.labelWidth')} (mm)<input type="number" min="20" step="0.1" value={size.width} onChange={(event) => onSizeChange({ ...size, width: Number(event.target.value) })} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium text-gray-600">{t('barcodes.labelHeight')} (mm)<input type="number" min="15" step="0.1" value={size.height} onChange={(event) => onSizeChange({ ...size, height: Number(event.target.value) })} className={`${fieldClass} mt-1`} /></label>
      </div>}
    </section>
  );
}

function A4Page({ cells, template, preview = false }: { cells: Array<LabelItem | null>; template: A4Template; preview?: boolean }) {
  return (
    <div className={preview ? 'barcode-a4-preview-frame' : ''}>
      <div className="barcode-a4-page" style={{
        padding: `${template.marginTop}mm ${template.marginRight}mm ${template.marginBottom}mm ${template.marginLeft}mm`,
        gridTemplateColumns: `repeat(${template.columns}, ${template.labelWidth}mm)`,
        gridTemplateRows: `repeat(${template.rows}, ${template.labelHeight}mm)`,
        columnGap: `${template.horizontalGap}mm`, rowGap: `${template.verticalGap}mm`,
      }}>
        {cells.map((item, index) => item ? <BarcodeLabel key={`${item.variantId}-${index}`} item={item} widthMm={template.labelWidth} heightMm={template.labelHeight} /> : <div key={`blank-${index}`} className="barcode-empty-cell" />)}
      </div>
    </div>
  );
}

function RollLabel({ item, size, preview = false }: { item: LabelItem; size: RollSize; preview?: boolean }) {
  return <div className={preview ? 'barcode-roll-preview-frame' : 'barcode-roll-page'} style={preview ? undefined : { width: `${size.width}mm`, height: `${size.height}mm` }}><BarcodeLabel item={item} widthMm={size.width} heightMm={size.height} /></div>;
}

function PrintPreview({ mode, pages, labels, template, rollSize }: { mode: PrintMode; pages: Array<Array<LabelItem | null>>; labels: LabelItem[]; template: A4Template; rollSize: RollSize }) {
  return <div className="barcode-preview-scroll">{mode === 'a4' ? pages.map((page, index) => <div key={index}><p className="mb-1 text-center text-xs text-gray-400">Page {index + 1}</p><A4Page cells={page} template={template} preview /></div>) : labels.map((item, index) => <div key={`${item.variantId}-${index}`}><p className="mb-1 text-center text-xs text-gray-400">Label {index + 1}</p><RollLabel item={item} size={rollSize} preview /></div>)}</div>;
}

function PrintOutput({ mode, pages, labels, template, rollSize }: { mode: PrintMode; pages: Array<Array<LabelItem | null>>; labels: LabelItem[]; template: A4Template; rollSize: RollSize }) {
  return <div id="barcode-print-root" aria-hidden="true">{mode === 'a4' ? pages.map((page, index) => <A4Page key={index} cells={page} template={template} />) : labels.map((item, index) => <RollLabel key={`${item.variantId}-${index}`} item={item} size={rollSize} />)}</div>;
}

function PrintStyles({ mode, template, rollSize }: { mode: PrintMode; template: A4Template; rollSize: RollSize }) {
  const previewScale = 0.42;
  return <style>{`
    #barcode-print-root { display: none; }
    .barcode-preview-scroll { display: flex; flex-direction: column; align-items: center; gap: 16px; max-height: 620px; overflow: auto; padding: 12px; background: #e5e7eb; border-radius: 12px; }
    .barcode-a4-preview-frame { width: ${A4_WIDTH_MM * previewScale}mm; height: ${A4_HEIGHT_MM * previewScale}mm; overflow: hidden; box-shadow: 0 1px 4px #0003; background: white; }
    .barcode-a4-preview-frame .barcode-a4-page { transform: scale(${previewScale}); transform-origin: top left; }
    .barcode-roll-preview-frame { width: ${rollSize.width}mm; height: ${rollSize.height}mm; background: white; box-shadow: 0 1px 4px #0003; }
    .barcode-a4-page { box-sizing: border-box; width: ${A4_WIDTH_MM}mm; height: ${A4_HEIGHT_MM}mm; display: grid; align-content: start; background: white; overflow: hidden; }
    .barcode-empty-cell { width: ${template.labelWidth}mm; height: ${template.labelHeight}mm; }
    .barcode-label-box { box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.2mm 1.5mm; background: white; color: black; font-family: Arial, sans-serif; text-align: center; }
    .barcode-label-name { max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: clamp(6pt, 2.5mm, 8pt); font-weight: 700; line-height: 1.08; overflow-wrap: anywhere; }
    .barcode-label-variant { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 5.5pt; color: #444; line-height: 1.1; }
    .barcode-label-svg { width: 92%; min-height: 7mm; max-height: 12mm; flex: 1 1 auto; margin: .6mm 0 .2mm; }
    .barcode-label-value { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font: 5.5pt/1.1 monospace; letter-spacing: .15mm; }
    .barcode-label-price { margin-top: .3mm; font-size: 8pt; font-weight: 800; line-height: 1; }
    .barcode-label-error { color: #b91c1c; font-size: 5.5pt; line-height: 1.1; }
    @media print {
      @page { size: ${mode === 'a4' ? 'A4' : `${rollSize.width}mm ${rollSize.height}mm`}; margin: 0; }
      html, body { width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: white !important; }
      body * { visibility: hidden !important; }
      #barcode-print-root, #barcode-print-root * { visibility: visible !important; }
      #barcode-print-root { display: block !important; position: absolute; inset: 0 auto auto 0; margin: 0; padding: 0; }
      .barcode-a4-page { break-after: page; page-break-after: always; }
      .barcode-a4-page:last-child { break-after: auto; page-break-after: auto; }
      .barcode-roll-page { display: block; box-sizing: border-box; overflow: hidden; break-after: page; page-break-after: always; }
      .barcode-roll-page:last-child { break-after: auto; page-break-after: auto; }
      .barcode-label-box { break-inside: avoid; page-break-inside: avoid; }
    }
  `}</style>;
}
