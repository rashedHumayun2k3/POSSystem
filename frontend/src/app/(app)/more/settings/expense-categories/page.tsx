"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from "@/lib/settingsApi";
import type { ExpenseCategory } from "@/types/settings";
import { useLanguage } from "@/i18n/LanguageContext";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

type FormMode = "add" | "edit" | null;
const EMPTY_FORM = { name: "", isDefault: false };

export default function ExpenseCategoriesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [mode, setMode] = useState<FormMode>(null);
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: getExpenseCategories,
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setError(""); setMode("add"); };
  const openEdit = (c: ExpenseCategory) => {
    setForm({ name: c.name, isDefault: c.isDefault });
    setEditTarget(c); setError(""); setMode("edit");
  };
  const close = () => { setMode(null); setEditTarget(null); setError(""); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === "add") await createExpenseCategory(form);
      else if (editTarget) await updateExpenseCategory(editTarget.id, form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expense-categories"] }); close(); },
    onError: () => setError(t("settings.failedSaveExpCat")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpenseCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-categories"] }),
  });

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t("settings.expCatTitle")}</h1>
        <button onClick={openAdd} className="text-sm font-semibold text-indigo-600">{t("settings.addCategory")}</button>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)
        ) : cats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t("settings.noExpCats")}</p>
        ) : (
          cats.map((c) => (
            <div key={c.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  {c.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => { if (confirm(t("settings.deleteConfirm", { name: c.name }))) deleteMutation.mutate(c.id); }}
                  className="p-1.5 rounded-lg bg-red-50 text-red-500">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <p className="text-base font-semibold text-gray-900">
              {mode === "add" ? t("settings.addCategory") : t("settings.edit")}
            </p>
            <input placeholder={t("settings.categoryName")} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded accent-indigo-600" />
              <span className="text-sm text-gray-700">{t("settings.isDefault")}</span>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
