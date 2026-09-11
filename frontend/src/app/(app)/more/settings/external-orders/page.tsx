'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  createExternalOrderIntegration,
  deleteExternalOrderIntegration,
  listExternalOrderIntegrations,
  setExternalOrderIntegrationActive,
  type CreateExternalOrderIntegrationResponse,
  type ExternalOrderIntegration,
} from '@/lib/externalOrdersApi';
import { useLanguage } from '@/i18n/LanguageContext';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';
import ConfirmSheet from '@/components/ui/ConfirmSheet';

const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/external/orders`;

function displayDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function websiteNameFromUrl(value: string) {
  try {
    return new URL(normalizeWebsiteUrl(value)).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || value;
  }
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function ExternalOrdersSettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { lang, t } = useLanguage();
  const [sourceWebsiteUrl, setSourceWebsiteUrl] = useState('');
  const [createdKey, setCreatedKey] = useState<CreateExternalOrderIntegrationResponse | null>(null);
  const [connectionToDelete, setConnectionToDelete] = useState<ExternalOrderIntegration | null>(null);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['external-order-integrations'],
    queryFn: listExternalOrderIntegrations,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const normalizedUrl = normalizeWebsiteUrl(sourceWebsiteUrl);
      return createExternalOrderIntegration({
        name: websiteNameFromUrl(normalizedUrl),
        sourceWebsiteUrl: normalizedUrl || null,
      });
    },
    onSuccess: (created) => {
      setCreatedKey(created);
      setSourceWebsiteUrl('');
      qc.invalidateQueries({ queryKey: ['external-order-integrations'] });
      useToastStore.getState().show(lang === 'bn' ? 'ইন্টিগ্রেশন তৈরি হয়েছে।' : 'Integration created.');
    },
    onError: (err: unknown) => toastError(err, lang === 'bn' ? 'ইন্টিগ্রেশন তৈরি করা যায়নি।' : 'Failed to create integration.'),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setExternalOrderIntegrationActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['external-order-integrations'] }),
    onError: (err: unknown) => toastError(err, lang === 'bn' ? 'স্ট্যাটাস আপডেট করা যায়নি।' : 'Failed to update status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExternalOrderIntegration(id),
    onSuccess: () => {
      setConnectionToDelete(null);
      qc.invalidateQueries({ queryKey: ['external-order-integrations'] });
      useToastStore.getState().show(lang === 'bn' ? 'কানেকশন সরানো হয়েছে।' : 'Connection removed.');
    },
    onError: (err: unknown) => toastError(err, lang === 'bn' ? 'কানেকশন সরানো যায়নি।' : 'Failed to remove connection.'),
  });

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    useToastStore.getState().show(lang === 'bn' ? 'কপি হয়েছে।' : 'Copied.');
  };

  const samplePayload = `{
  "customerName": "Customer Name",
  "customerPhone": "01700000000",
  "customerAddress": "Dhaka",
  "items": [
    { "sku": "SKU-001", "qty": 1, "unitPrice": 500 }
  ],
  "deliveryChargeCustomer": 80,
  "advancePaid": 0,
  "externalOrderId": "WEB-1001",
  "sourceWebsiteUrl": "https://example.com"
}`;

  const sourceWebsiteUrlFromInput = () => {
    if (createdKey?.sourceWebsiteUrl) return createdKey.sourceWebsiteUrl;
    if (sourceWebsiteUrl.trim()) return sourceWebsiteUrl.trim();
    return null;
  };

  const downloadDeveloperDocument = (integration: CreateExternalOrderIntegrationResponse) => {
    const safeApiKey = integration.apiKey;
    const safeWebsite = integration.sourceWebsiteUrl || integration.name;
    const fileName = `${integration.name || 'external-order'}-integration-guide`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const html = `<!doctype html>
<html lang="${lang === 'bn' ? 'bn' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>External Website Order Integration</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.55; margin: 0; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    h2 { font-size: 18px; margin-top: 28px; }
    code, pre { background: #f3f4f6; border-radius: 8px; }
    code { padding: 2px 6px; }
    pre { padding: 14px; overflow: auto; white-space: pre-wrap; }
    .key-box { border: 2px solid #2563eb; background: #eff6ff; border-radius: 14px; padding: 16px; margin: 18px 0; }
    .key-label { color: #1d4ed8; font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px; }
    .key { font-size: 18px; font-weight: 700; word-break: break-all; margin: 0; }
    .warning { color: #b91c1c; font-weight: 700; }
    .muted { color: #6b7280; }
  </style>
</head>
<body>
  <h1>External Website Order Integration</h1>
  <p class="muted">Give this document to your website developer.</p>

  <div class="key-box">
    <p class="key-label">API Key - Important</p>
    <p class="key">${escapeHtml(safeApiKey)}</p>
    <p class="warning">Keep this key private. Do not show it on public frontend JavaScript if possible.</p>
  </div>

  <h2>Connection</h2>
  <p><strong>Website:</strong> ${escapeHtml(safeWebsite)}</p>
  <p><strong>POST URL:</strong> <code>${escapeHtml(webhookUrl)}</code></p>
  <p><strong>Header:</strong> <code>X-External-Order-Key: ${escapeHtml(safeApiKey)}</code></p>

  <h2>Request JSON</h2>
  <pre>${escapeHtml(samplePayload)}</pre>

  <h2>JavaScript Example</h2>
  <pre>${escapeHtml(`fetch('${webhookUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-External-Order-Key': '${safeApiKey}'
  },
  body: JSON.stringify({
    customerName: 'Customer Name',
    customerPhone: '01700000000',
    customerAddress: 'Dhaka',
    items: [
      { sku: 'SKU-001', qty: 1, unitPrice: 500 }
    ],
    deliveryChargeCustomer: 80,
    advancePaid: 0,
    externalOrderId: 'WEB-1001',
    sourceWebsiteUrl: '${safeWebsite}'
  })
});`)}</pre>

  <h2>Success Response</h2>
  <pre>${escapeHtml(`{
  "orderId": "uuid",
  "orderNo": "ORD-0001",
  "status": "CREATED"
}`)}</pre>
</body>
</html>`;
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    const frameDocument = printFrame.contentDocument ?? frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      printFrame.remove();
      useToastStore.getState().show(lang === 'bn' ? 'PDF ডকুমেন্ট তৈরি করা যায়নি।' : 'Could not create PDF document.');
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
    frameDocument.title = `${fileName}.pdf`;
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      setTimeout(() => printFrame.remove(), 1000);
    }, 300);
    useToastStore.getState().show(lang === 'bn' ? 'PDF হিসেবে সেভ করার উইন্ডো খুলেছে।' : 'Save as PDF window opened.');
  };

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('settings.externalOrders')}</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <section className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">
            {lang === 'bn' ? 'ওয়েবসাইট থেকে POS-এ অর্ডার নিন' : 'Receive website orders in POS'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {lang === 'bn'
              ? 'নিজের ওয়েবসাইট, পুরনো সাইট, অথবা Zapier এই webhook-এ অর্ডার পাঠাবে। অর্ডারগুলো Orders পেজে নতুন অর্ডার হিসেবে আসবে।'
              : 'Your website, legacy site, or Zapier can send orders to this webhook. They will appear as new orders in Orders.'}
          </p>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white px-4 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">
            {lang === 'bn' ? 'নতুন ওয়েবসাইট কানেকশন' : 'New website connection'}
          </p>
          <label className="block text-xs font-medium text-gray-500">
            {lang === 'bn' ? 'আপনার ওয়েবসাইটের লিংক' : 'Your website link'}
          </label>
          <input
            value={sourceWebsiteUrl}
            onChange={(e) => setSourceWebsiteUrl(e.target.value)}
            placeholder="https://www.yourshopwebsite.com/"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!sourceWebsiteUrl.trim() || createMutation.isPending}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {createMutation.isPending
              ? t('common.creating')
              : (lang === 'bn' ? 'API key তৈরি করুন' : 'Create API key')}
          </button>
        </section>

        {createdKey && (
          <section className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-blue-900">
              {lang === 'bn' ? 'ডেভেলপার ডকুমেন্ট প্রস্তুত' : 'Developer document is ready'}
            </p>
            <p className="text-xs leading-relaxed text-blue-700">
              {lang === 'bn'
                ? 'আপনার API key ডকুমেন্টেশনের একদম উপরে নীল মার্ক দিয়ে যুক্ত করা আছে। ডকুমেন্টটি ডাউনলোড করে আপনার ওয়েবসাইট ডেভেলপারকে দিন।'
                : 'Your API key is included at the top of the documentation in a blue highlighted section. Download it and share it with your website developer.'}
            </p>
            <button
              type="button"
              onClick={() => downloadDeveloperDocument(createdKey)}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
            >
              {lang === 'bn' ? 'PDF ডকুমেন্ট ডাউনলোড করুন' : 'Download PDF documentation'}
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white px-4 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">{lang === 'bn' ? 'Webhook সেটআপ' : 'Webhook setup'}</p>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">POST URL</p>
            <CodeRow value={webhookUrl} onCopy={copyText} copyLabel={lang === 'bn' ? 'কপি' : 'Copy'} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">Header</p>
            <CodeRow value="X-External-Order-Key: YOUR_API_KEY" onCopy={copyText} copyLabel={lang === 'bn' ? 'কপি' : 'Copy'} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">{lang === 'bn' ? 'Sample JSON' : 'Sample JSON'}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{samplePayload}</pre>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {lang === 'bn' ? 'কানেকশন লিস্ট' : 'Connections'}
          </p>
          {isLoading ? (
            <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ) : integrations.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
              {lang === 'bn' ? 'এখনো কোনো কানেকশন নেই।' : 'No connections yet.'}
            </p>
          ) : (
            integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                lang={lang}
                onToggle={(isActive) => activeMutation.mutate({ id: integration.id, isActive })}
                onDelete={() => setConnectionToDelete(integration)}
                disabled={activeMutation.isPending || deleteMutation.isPending}
              />
            ))
          )}
        </section>
      </div>

      <ConfirmSheet
        open={!!connectionToDelete}
        onClose={() => setConnectionToDelete(null)}
        title={lang === 'bn' ? 'কানেকশন সরিয়ে ফেলবেন?' : 'Remove this connection?'}
        titleClassName="text-red-600"
        note={
          lang === 'bn'
            ? 'এই API key আর ব্যবহার করা যাবে না। পুরনো ওয়েবসাইট থেকে নতুন অর্ডার পাঠাতে হলে আবার নতুন কানেকশন তৈরি করতে হবে।'
            : 'This API key will no longer work. To send orders from the old website again, you will need to create a new connection.'
        }
        closeLabel={lang === 'bn' ? 'না, রাখুন' : 'No, keep it'}
        confirmLabel={deleteMutation.isPending ? (lang === 'bn' ? 'সরানো হচ্ছে...' : 'Removing...') : (lang === 'bn' ? 'হ্যাঁ, সরিয়ে ফেলুন' : 'Yes, remove')}
        onConfirm={() => {
          if (connectionToDelete) deleteMutation.mutate(connectionToDelete.id);
        }}
        confirmDisabled={deleteMutation.isPending}
        confirmClassName="bg-red-500 text-white"
      >
        {connectionToDelete && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            <p className="truncate text-sm font-semibold text-gray-900">{connectionToDelete.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {connectionToDelete.sourceWebsiteUrl ?? (lang === 'bn' ? 'ওয়েবসাইট URL নেই' : 'No website URL')}
            </p>
          </div>
        )}
      </ConfirmSheet>
    </div>
  );
}

function CodeRow({ value, copyLabel, onCopy }: { value: string; copyLabel: string; onCopy: (text: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-[11px] text-gray-700">{value}</code>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600"
      >
        {copyLabel}
      </button>
    </div>
  );
}

function IntegrationCard({
  integration,
  lang,
  onToggle,
  onDelete,
  disabled,
}: {
  integration: ExternalOrderIntegration;
  lang: 'bn' | 'en';
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{integration.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{integration.sourceWebsiteUrl ?? (lang === 'bn' ? 'ওয়েবসাইট URL নেই' : 'No website URL')}</p>
          <p className="text-[11px] text-gray-400 mt-1">{lang === 'bn' ? 'তৈরি' : 'Created'}: {displayDate(integration.createdAt)}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(!integration.isActive)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            integration.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          } disabled:opacity-50`}
        >
          {integration.isActive
            ? (lang === 'bn' ? 'চালু' : 'Active')
            : (lang === 'bn' ? 'বন্ধ' : 'Inactive')}
        </button>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
      >
        {lang === 'bn' ? 'সরিয়ে ফেলুন' : 'Remove'}
      </button>
    </div>
  );
}
