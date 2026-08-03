'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getExpenseCategories } from '@/lib/settingsApi';
import { createExpense } from '@/lib/expensesApi';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExpenseCategoryDto } from '@/types/expenses';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';

// ── Step identifiers ─────────────────────────────────────────────────────────
type Step = 'category' | 'subtype' | 'amount' | 'date' | 'note';
const STEPS: Step[] = ['category', 'subtype', 'amount', 'date', 'note'];

const CATEGORY_ICONS: Record<string, string> = {
  OFFICE:          '🖥️',
  STAFF:           '👤',
  MARKETING:       '📣',
  DELIVERY:        '🚚',
  TRIP:            '✈️',
  EQUIPMENT_OTHER: '🔧',
  OWNER_DRAWING:   '💸',
};

const QUICK_SUBTYPES: Record<string, string[]> = {
  OFFICE:          ['Rent', 'Electricity', 'Internet', 'Stationery', 'Cleaning'],
  STAFF:           ['Salary', 'Bonus', 'Advance', 'Overtime', 'Transport allowance'],
  MARKETING:       ['Facebook Ads', 'Boost post', 'Banner', 'Packaging design', 'Promotional gift'],
  DELIVERY:        ['Courier fee', 'Petrol', 'Vehicle maintenance', 'Parking'],
  TRIP:            ['Flight ticket', 'Hotel', 'Food', 'Visa fee', 'Customs', 'Local transport'],
  EQUIPMENT_OTHER: ['Equipment purchase', 'Repair', 'Furniture', 'Software', 'Miscellaneous'],
  OWNER_DRAWING:   ['Personal drawing', 'Personal transfer'],
};

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewExpensePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>('category');
  const [categoryId, setCategoryId] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [subType, setSubType] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');

  const { data: cats = [], isLoading: catsLoading } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: getExpenseCategories,
  });

  const mutation = useMutation({
    mutationFn: () => createExpense({
      categoryId,
      subType: subType.trim(),
      amount: parseFloat(amount),
      expenseDate: date,
      isRecurring: false,
      note: note.trim() || null,
    }),
    onSuccess: () => router.back(),
    onError: (err: unknown) => toastError(err, t('expenses.failedCreate')),
  });

  const stepIndex = STEPS.indexOf(step);

  function goBack() {
    if (stepIndex === 0) { router.back(); return; }
    setStep(STEPS[stepIndex - 1]);
  }

  function goNext() {
    if (step === 'category') {
      if (!categoryId) { useToastStore.getState().show(t('expenses.selectCategory'), 'error'); return; }
      setStep('subtype');
    } else if (step === 'subtype') {
      if (!subType.trim()) { useToastStore.getState().show(t('expenses.enterSubtype'), 'error'); return; }
      setStep('amount');
    } else if (step === 'amount') {
      const n = parseFloat(amount);
      if (!amount || isNaN(n) || n <= 0) { useToastStore.getState().show(t('expenses.enterAmount'), 'error'); return; }
      setStep('date');
    } else if (step === 'date') {
      if (!date) { useToastStore.getState().show(t('expenses.selectDate'), 'error'); return; }
      setStep('note');
    } else if (step === 'note') {
      mutation.mutate();
    }
  }

  const quickSubtypes = QUICK_SUBTYPES[categoryCode] ?? [];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('expenses.newTitle')}</h1>
        {/* Step indicator */}
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                i < stepIndex ? 'w-4 bg-indigo-400'
                : i === stepIndex ? 'w-6 bg-indigo-600'
                : 'w-4 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {/* STEP 1: Category */}
        {step === 'category' && (
          <>
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepCategory')}</p>
            {catsLoading ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(cats as ExpenseCategoryDto[]).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCategoryId(c.id); setCategoryCode(c.code); setStep('subtype'); }}
                    className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition-all ${
                      categoryId === c.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                    }`}
                  >
                    <span className="text-2xl">{CATEGORY_ICONS[c.code] ?? '📋'}</span>
                    <span className="text-sm font-semibold text-gray-900 leading-tight">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* STEP 2: Sub-type */}
        {step === 'subtype' && (
          <>
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepSubtype')}</p>
            {quickSubtypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickSubtypes.map(q => (
                  <button
                    key={q}
                    onClick={() => { setSubType(q); setStep('amount'); }}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      subType === q
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <input
              autoFocus
              type="text"
              placeholder={t('expenses.subtypePlaceholder')}
              value={subType}
              onChange={e => setSubType(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </>
        )}

        {/* STEP 3: Amount */}
        {step === 'amount' && (
          <>
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepAmount')}</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">৳</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && goNext()}
                className="w-full h-14 pl-9 pr-4 rounded-xl border border-gray-200 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setAmount(String(n))}
                  className={`h-10 rounded-xl border text-sm font-semibold transition-all ${
                    amount === String(n)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  ৳{n.toLocaleString()}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 4: Date */}
        {step === 'date' && (
          <>
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepDate')}</p>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              {[
                { label: t('expenses.today'), val: todayStr() },
                { label: t('expenses.yesterday'), val: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() },
              ].map(({ label, val }) => (
                <button
                  key={val}
                  onClick={() => setDate(val)}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-all ${
                    date === val
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 5: Note + confirm */}
        {step === 'note' && (
          <>
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepNote')}</p>

            {/* Summary card */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('expenses.category')}</span>
                <span className="font-medium text-gray-900">
                  {(cats as ExpenseCategoryDto[]).find(c => c.id === categoryId)?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('expenses.subtype')}</span>
                <span className="font-medium text-gray-900">{subType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('expenses.amount')}</span>
                <span className="font-bold text-indigo-700 text-base">৳{parseFloat(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('expenses.date')}</span>
                <span className="font-medium text-gray-900">{date}</span>
              </div>
            </div>

            <textarea
              rows={3}
              placeholder={t('expenses.notePlaceholder')}
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </>
        )}

      </div>

      {/* Bottom CTA */}
      {step !== 'category' && (
        <div className="shrink-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100">
          <button
            onClick={goNext}
            disabled={mutation.isPending}
            className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
          >
            {mutation.isPending
              ? t('common.saving')
              : step === 'note'
                ? t('expenses.saveExpense')
                : t('expenses.next')}
          </button>
        </div>
      )}
    </div>
  );
}
