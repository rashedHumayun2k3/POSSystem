'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { listExpenses, approveExpense, rejectExpense, deleteExpense } from '@/lib/expensesApi';
import { getExpenseCategories } from '@/lib/settingsApi';
import type { ExpenseDto } from '@/types/expenses';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/i18n/LanguageContext';

const STATUS_TABS = ['ALL', 'PENDING', 'APPROVED'] as const;
type Tab = (typeof STATUS_TABS)[number];

const STATUS_PILL: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
};

function fmt(n: number) {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExpensesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isOwner = user?.role === 'OWNER';

  const [tab, setTab] = useState<Tab>('ALL');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: result, isLoading } = useQuery({
    queryKey: ['expenses', tab],
    queryFn: () => listExpenses({ status: tab === 'ALL' ? undefined : tab, pageSize: 100 }),
  });
  const expenses = result?.items ?? [];

  const { data: cats = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: getExpenseCategories,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExpense(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setRejectTarget(null); setRejectReason(''); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const totalApproved = expenses
    .filter(e => e.status === 'APPROVED')
    .reduce((s, e) => s + e.amount, 0);

  const pendingCount = expenses.filter(e => e.status === 'PENDING').length;

  function ExpenseCard({ e }: { e: ExpenseDto }) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{e.subType}</p>
            <p className="text-xs text-gray-400">{e.categoryName} · {fmtDate(e.expenseDate)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-gray-900">{fmt(e.amount)}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[e.status]}`}>
              {e.status}
            </span>
          </div>
        </div>

        {e.note && <p className="text-xs text-gray-500 italic">{e.note}</p>}
        {e.staffName && <p className="text-xs text-gray-400">{t('expenses.staff')}: {e.staffName}</p>}
        {e.rejectionReason && (
          <p className="text-xs text-red-500">{t('expenses.rejectedReason')}: {e.rejectionReason}</p>
        )}

        {/* Owner action row for pending items */}
        {isOwner && e.status === 'PENDING' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => approveMut.mutate(e.id)}
              disabled={approveMut.isPending}
              className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <CheckIcon className="w-3.5 h-3.5" /> {t('common.approve')}
            </button>
            <button
              onClick={() => { setRejectTarget(e.id); setRejectReason(''); }}
              className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <XMarkIcon className="w-3.5 h-3.5" /> {t('common.reject')}
            </button>
          </div>
        )}

        {/* Owner delete for non-petty-cash approved */}
        {isOwner && e.status !== 'PENDING' && !e.pettyCashBoxId && (
          <button
            onClick={() => { if (confirm(t('expenses.deleteConfirm'))) deleteMut.mutate(e.id); }}
            className="text-xs text-gray-300 hover:text-red-400 transition-colors"
          >
            {t('common.delete')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('expenses.title')}</h1>
        <button
          onClick={() => router.push('/more/expenses/new')}
          className="flex items-center gap-1 text-sm font-semibold text-indigo-600"
        >
          <PlusIcon className="w-4 h-4" /> {t('expenses.add')}
        </button>
      </div>

      {/* Summary banner */}
      {isOwner && (
        <div className="mx-4 mt-4 bg-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-500 font-medium">{t('expenses.totalApproved')}</p>
            <p className="text-xl font-bold text-indigo-700">{fmt(totalApproved)}</p>
          </div>
          {pendingCount > 0 && (
            <div className="text-right">
              <p className="text-xs text-amber-600 font-medium">{t('expenses.awaitingApproval')}</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4 pb-2">
        {STATUS_TABS.map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === t2
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {t2 === 'ALL' ? t('expenses.tabAll')
              : t2 === 'PENDING' ? t('expenses.tabPending')
              : t('expenses.tabApproved')}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : expenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">{t('expenses.noExpenses')}</p>
        ) : (
          expenses.map(e => <ExpenseCard key={e.id} e={e} />)
        )}
      </div>

      {/* Reject sheet */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectTarget(null)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <p className="text-base font-semibold text-gray-900">{t('expenses.rejectTitle')}</p>
            <textarea
              rows={3}
              placeholder={t('expenses.rejectReasonPlaceholder')}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              onClick={() => rejectMut.mutate({ id: rejectTarget, reason: rejectReason })}
              disabled={rejectMut.isPending || !rejectReason.trim()}
              className="w-full h-12 rounded-xl bg-red-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {rejectMut.isPending ? t('common.saving') : t('expenses.confirmReject')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
