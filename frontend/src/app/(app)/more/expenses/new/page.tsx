'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenseCategories } from '@/lib/settingsApi';
import { createExpense, listExpenses } from '@/lib/expensesApi';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExpenseCategoryDto } from '@/types/expenses';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';
import { EXPENSE_CATEGORY_ICONS } from '@/lib/expenseCategoryIcons';
import SlidePanel from '@/components/ui/SlidePanel';
import { periodToDates } from '@/components/reports/DateRangeBar';
import type { ReportPeriod } from '@/types/reports';
import { useAuthStore } from '@/store/authStore';

const HISTORY_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
];

// ── Step identifiers ─────────────────────────────────────────────────────────
// Amount and date used to be separate steps — merged into one screen since they're both
// quick, small inputs and splitting them just added an extra tap for no reason.
type Step = 'category' | 'subtype' | 'amountDate' | 'note';
const STEPS: Step[] = ['category', 'subtype', 'amountDate', 'note'];

const QUICK_SUBTYPES: Record<string, string[]> = {
  OFFICE:          ['Rent', 'Electricity', 'Internet', 'Stationery', 'Cleaning', 'Mobile/Phone Bill', 'Bank/MFS Charge'],
  STAFF:           ['Salary', 'Delivery rider salary', 'Bonus', 'Advance', 'Overtime', 'Transport allowance'],
  MARKETING:       ['Facebook Ads', 'Boost post', 'Banner', 'Packaging design', 'Promotional gift'],
  DELIVERY:        ['Courier fee', 'Return charge', 'COD collection charge', 'Petrol', 'Van/Rickshaw rent', 'Vehicle maintenance', 'Toll/Ferry', 'Parking', 'Packaging Materials'],
  TRIP:            ['Flight ticket', 'Hotel', 'Food', 'Visa fee', 'Customs', 'Local transport'],
  EQUIPMENT_OTHER: ['Equipment purchase', 'Repair', 'Furniture', 'Software', 'Miscellaneous'],
  OWNER_DRAWING:   ['Personal drawing', 'Personal transfer'],
  INVENTORY_LOSS:  ['Damage Loss', 'Expired/Near-expiry write-off', 'Theft/Pilferage', 'Stock count adjustment'],
  SETUP_CAPEX:     ['Shop Rent Advance/Deposit', 'Shop Decoration/Renovation', 'CCTV & Security System', 'Signboard/Branding', 'POS/Computer Setup', 'Initial Furniture & Fixtures', 'Shop/Property Purchase', 'Business Registration/Trade License'],
};

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// Not a real subtype the business tracks a total for — "Others" tags the expense generically and
// pushes the actual detail into the Note field instead, so odd one-offs don't fragment reporting
// into dozens of near-duplicate free-text subtypes (see conversation: chose this over a
// per-user/per-business "remembered custom subtype" list for exactly that reason).
const OTHER_SUBTYPE = 'Other';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// createdAt is the only field that actually carries a real time — when this entry was logged,
// not the (time-less) business date it was logged for. Used to tell apart same-day entries.
function formatLoggedAt(iso: string) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

export default function NewExpensePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const currentBranchId = useAuthStore((s) => s.currentBranchId);

  const [step, setStep] = useState<Step>('category');
  const [categoryId, setCategoryId] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [subType, setSubType] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<ReportPeriod>('30d');
  const [showAllToday, setShowAllToday] = useState(false);

  const { data: cats = [], isLoading: catsLoading } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: getExpenseCategories,
  });

  // Last-30-days total per category — shown right on the category tiles so staff can see at a
  // glance where money's already gone before picking where to log a new entry.
  const { data: allRecentResult } = useQuery({
    queryKey: ['expense-history-all', '30d', currentBranchId],
    queryFn: () => listExpenses({ ...periodToDates('30d'), pageSize: 200 }),
    enabled: step === 'category',
  });
  const totalsByCategory = (allRecentResult?.items ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.categoryId] = (acc[e.categoryId] ?? 0) + e.amount;
    return acc;
  }, {});

  // Today's entries, most recent first — a quick "what's already been logged today" summary
  // above the category grid, so staff don't have to leave this page to sanity-check that.
  const todayExpenses = (allRecentResult?.items ?? [])
    .filter(e => e.expenseDate.slice(0, 10) === todayStr())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);
  const TODAY_PREVIEW_COUNT = 5;
  const visibleTodayExpenses = showAllToday ? todayExpenses : todayExpenses.slice(0, TODAY_PREVIEW_COUNT);

  // Recent spend in this category — shown on the subtype step so staff can see what's already
  // been logged (e.g. "we already paid rent this month?") before adding another entry.
  const { data: historyResult, isLoading: historyLoading } = useQuery({
    queryKey: ['expense-history', categoryId, historyPeriod, currentBranchId],
    queryFn: () => listExpenses({ categoryId, ...periodToDates(historyPeriod), pageSize: 20 }),
    enabled: step === 'subtype' && !!categoryId,
  });
  const history = historyResult?.items ?? [];

  // Grouped by subtype — a flat chronological list read like a confusing wall of repeated dates
  // once the same subtype (e.g. "Courier fee") had several entries; grouping answers "how much
  // and when, for this specific thing" at a glance instead.
  const historyBySubtype = history.reduce<Record<string, typeof history>>((acc, e) => {
    (acc[e.subType] ??= []).push(e);
    return acc;
  }, {});

  const mutation = useMutation({
    mutationFn: () => createExpense({
      categoryId,
      subType: subType.trim(),
      amount: parseFloat(amount),
      expenseDate: date,
      isRecurring: false,
      note: note.trim() || null,
    }),
    // No navigation at all — just close the sheet and land back on the subtype screen (same
    // category) so logging several entries in a row doesn't bounce you off the page each time.
    onSuccess: () => {
      useToastStore.getState().show(t('expenses.saved'));
      qc.invalidateQueries({ queryKey: ['expense-history'] });
      qc.invalidateQueries({ queryKey: ['expense-history-all'] });
      setSubType('');
      setAmount('');
      setDate(todayStr());
      setNote('');
      setStep('subtype');
    },
    onError: (err: unknown) => toastError(err, t('expenses.failedCreate')),
  });

  const stepIndex = STEPS.indexOf(step);

  function goBack() {
    if (stepIndex === 0) { router.back(); return; }
    setStep(STEPS[stepIndex - 1]);
  }

  function goNext() {
    if (step === 'amountDate') {
      const n = parseFloat(amount);
      if (!amount || isNaN(n) || n <= 0) { useToastStore.getState().show(t('expenses.enterAmount'), 'error'); return; }
      if (!date) { useToastStore.getState().show(t('expenses.selectDate'), 'error'); return; }
      setStep('note');
    } else if (step === 'note') {
      // "Other" carries no descriptive info on its own — without a note it'd just be an
      // unexplained amount sitting under a generic bucket forever.
      if (subType === OTHER_SUBTYPE && !note.trim()) {
        useToastStore.getState().show(t('expenses.otherNeedsNote'), 'error');
        return;
      }
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
            {/* Today's total, with an expandable line-by-line breakdown — a running sanity check
                right where entries get added, so staff can see what's already been logged today
                without leaving this page. */}
            {todayExpenses.length > 0 && (
              <div className="bg-indigo-50 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-indigo-900">{t('expenses.todayTotal')}</p>
                  <p className="text-lg font-bold text-indigo-700">৳{todayTotal.toLocaleString()}</p>
                </div>
                <p className="text-xs font-medium text-indigo-500 mt-3 mb-1.5">{t('expenses.details')}</p>
                <div className="space-y-1.5">
                  {visibleTodayExpenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">
                        {e.subType} <span className="text-xs text-gray-400">({new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })})</span>
                      </span>
                      <span className="font-medium text-gray-900 shrink-0 ml-2">৳{e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {todayExpenses.length > TODAY_PREVIEW_COUNT && (
                  <button
                    onClick={() => setShowAllToday(v => !v)}
                    className="mt-2 text-xs font-semibold text-indigo-600"
                  >
                    {showAllToday
                      ? t('common.showLess')
                      : `${t('common.showMore')} (${visibleTodayExpenses.length}/${todayExpenses.length})`}
                  </button>
                )}
              </div>
            )}

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
                    <div className="w-full flex items-center justify-between">
                      <span className="text-2xl">{EXPENSE_CATEGORY_ICONS[c.code] ?? '📋'}</span>
                      <span className="text-sm font-medium text-gray-500">
                        ৳{(totalsByCategory[c.id] ?? 0).toLocaleString()}
                      </span>
                    </div>
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
            <div className="flex flex-wrap gap-2">
              {quickSubtypes.map(q => (
                <button
                  key={q}
                  onClick={() => { setSubType(q); setStep('amountDate'); }}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    subType === q
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {q}
                </button>
              ))}
              <button
                onClick={() => { setSubType(OTHER_SUBTYPE); setStep('amountDate'); }}
                className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  subType === OTHER_SUBTYPE
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-dashed border-gray-300 hover:border-indigo-300'
                }`}
              >
                {t('expenses.otherSubtype')}
              </button>
            </div>

            {/* Recent spend in this category — context while deciding which subtype to log next. */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">{t('expenses.recentHistory')}</p>
                <div className="flex bg-gray-100 rounded-xl p-0.5">
                  {HISTORY_PERIODS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setHistoryPeriod(p.key)}
                      className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-colors ${
                        historyPeriod === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {historyLoading ? (
                <div className="h-16 flex items-center justify-center text-gray-400 text-xs">{t('common.loading')}</div>
              ) : history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">{t('expenses.noHistory')}</p>
              ) : (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {Object.entries(historyBySubtype).map(([subtype, entries]) => (
                    <div key={subtype} className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-gray-800 mb-1.5">{subtype}</p>
                      <div className="space-y-1">
                        {entries.map(e => (
                          <div key={e.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{formatLoggedAt(e.createdAt)}</span>
                            <span className="font-medium text-gray-700">৳{e.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Amount + Date — bottom slide instead of a full-page step, same shared SlidePanel used
          elsewhere in the app (e.g. the courier manager popup on orders/new). */}
      <SlidePanel
        open={step === 'amountDate'}
        onClose={goBack}
        title={t('expenses.stepAmount')}
        footer={
          <button
            onClick={goNext}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
          >
            {t('expenses.next')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-4">
          {/* Which category/subtype this amount is for — easy to lose track of once the amount
              step is its own sheet, separated from the category/subtype screens behind it. */}
          <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2.5">
            <span className="text-xl shrink-0">{EXPENSE_CATEGORY_ICONS[categoryCode] ?? '📋'}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-indigo-900 truncate">{subType}</p>
              <p className="text-xs text-indigo-500 truncate">
                {(cats as ExpenseCategoryDto[]).find(c => c.id === categoryId)?.name ?? '—'}
              </p>
            </div>
          </div>

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

          <p className="text-lg font-semibold text-gray-900 pt-2">{t('expenses.stepDate')}</p>
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
        </div>
      </SlidePanel>

      {/* Note + confirm — same bottom-slide style as the amount+date sheet above, so the two
          final steps read as one consistent pattern instead of a sheet followed by a full page. */}
      <SlidePanel
        open={step === 'note'}
        onClose={goBack}
        title={t('expenses.stepNote')}
        footer={
          <button
            onClick={goNext}
            disabled={mutation.isPending}
            className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
          >
            {mutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-4">
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
              <span className="font-bold text-indigo-700 text-base">৳{parseFloat(amount || '0').toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('expenses.date')}</span>
              <span className="font-medium text-gray-900">{date}</span>
            </div>
          </div>

          {subType === OTHER_SUBTYPE && (
            <p className="text-xs text-amber-600">{t('expenses.otherNeedsNote')}</p>
          )}
          <textarea
            autoFocus={subType === OTHER_SUBTYPE}
            rows={3}
            placeholder={subType === OTHER_SUBTYPE ? t('expenses.otherSubtype') : t('expenses.notePlaceholder')}
            value={note}
            onChange={e => setNote(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 ${
              subType === OTHER_SUBTYPE ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-indigo-500'
            }`}
          />
        </div>
      </SlidePanel>
    </div>
  );
}
