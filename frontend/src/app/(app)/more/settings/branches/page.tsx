"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listBranches, createBranch, updateBranch, toggleBranchActive } from "@/lib/branchesApi";
import type { Branch } from "@/types/branch";
import { useLanguage } from "@/i18n/LanguageContext";
import { PencilIcon } from "@heroicons/react/24/outline";
import { toastError } from "@/lib/toastError";

type FormMode = "add" | "edit" | null;
const EMPTY_FORM = { name: "", code: "", address: "", phone: "" };

export default function BranchesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [mode, setMode] = useState<FormMode>(null);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: listBranches,
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setMode("add"); };
  const openEdit = (b: Branch) => {
    setForm({ name: b.name, code: b.code, address: b.address ?? "", phone: b.phone ?? "" });
    setEditTarget(b); setMode("edit");
  };
  const close = () => { setMode(null); setEditTarget(null); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };
      if (mode === "add") await createBranch(payload);
      else if (editTarget) await updateBranch(editTarget.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); close(); },
    onError: (err) => toastError(err, t("settings.failedSaveBranch")),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleBranchActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
    onError: (err) => toastError(err, t("settings.failedSaveBranch")),
  });

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t("settings.branchesTitle")}</h1>
        <button onClick={openAdd} className="text-sm font-semibold text-indigo-600">{t("settings.addBranch")}</button>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : branches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t("settings.noBranches")}</p>
        ) : (
          branches.map((b) => (
            <div key={b.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{b.code}</span>
                  {b.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                      {t("settings.defaultBadge")}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {b.isActive ? t("settings.active") : t("settings.inactive")}
                  </span>
                </div>
                {(b.address || b.phone) && (
                  <p className="text-xs text-gray-400 mt-1">{[b.address, b.phone].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleMutation.mutate(b.id)}
                  disabled={toggleMutation.isPending}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50 ${
                    b.isActive ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                  }`}
                >
                  {b.isActive ? t("settings.deactivate") : t("settings.activate")}
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
              {mode === "add" ? t("settings.addBranch") : t("settings.edit")}
            </p>
            <input placeholder={t("settings.branchName")} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder={t("settings.branchCode")} value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder={t("settings.branchAddress")} value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder={t("settings.branchPhone")} value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || !form.code.trim()}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
