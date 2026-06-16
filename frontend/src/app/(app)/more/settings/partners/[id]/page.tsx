"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPartner,
  updatePartner,
  listPartnerLedger,
  recordCapitalInjection,
} from "@/lib/partnersApi";
import type { PartnerType } from "@/types/partner";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatPaisa } from "@/lib/format";
import { PencilIcon } from "@heroicons/react/24/outline";
import SlidePanel from "@/components/ui/SlidePanel";

const ENTRY_TYPE_KEY: Record<string, string> = {
  CAPITAL_INJECTION: "partners.entryCapitalInjection",
  CORRECTION: "partners.entryCorrection",
};

const EMPTY_EDIT_FORM = { name: "", phone: "", partnerType: "SLEEPING" as PartnerType, joinDate: "", note: "" };
const EMPTY_INJECTION_FORM = { amountTaka: "", lockInMonths: "12", note: "" };

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState("");

  const [injectionOpen, setInjectionOpen] = useState(false);
  const [injectionForm, setInjectionForm] = useState(EMPTY_INJECTION_FORM);
  const [injectionError, setInjectionError] = useState("");

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partners", id],
    queryFn: () => getPartner(id),
  });

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["partners", id, "ledger"],
    queryFn: () => listPartnerLedger(id),
  });

  const openEdit = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      phone: partner.phone ?? "",
      partnerType: partner.partnerType,
      joinDate: partner.joinDate ? partner.joinDate.slice(0, 10) : "",
      note: partner.note ?? "",
    });
    setEditError("");
    setEditOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: () =>
      updatePartner(id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        partnerType: editForm.partnerType,
        joinDate: editForm.joinDate || undefined,
        note: editForm.note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      setEditOpen(false);
    },
    onError: () => setEditError(t("partners.failedSavePartner")),
  });

  const openInjection = () => { setInjectionForm(EMPTY_INJECTION_FORM); setInjectionError(""); setInjectionOpen(true); };

  const injectionMutation = useMutation({
    mutationFn: () =>
      recordCapitalInjection(id, {
        amountPaisa: Math.round(parseFloat(injectionForm.amountTaka || "0") * 100),
        lockInMonths: parseInt(injectionForm.lockInMonths, 10) || 0,
        note: injectionForm.note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners", id] });
      qc.invalidateQueries({ queryKey: ["partners", id, "ledger"] });
      qc.invalidateQueries({ queryKey: ["partners"] });
      setInjectionOpen(false);
    },
    onError: () => setInjectionError(t("partners.failedSaveInjection")),
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">{partner?.name ?? "…"}</h1>
        {partner && (
          <button onClick={openEdit} className="p-1.5 rounded-lg bg-gray-50 text-gray-500">
            <PencilIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading || !partner ? (
        <div className="px-4 pt-4 space-y-2">
          <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          {/* Profile + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${partner.partnerType === "MANAGING" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
              {partner.partnerType === "MANAGING" ? t("partners.typeManaging") : t("partners.typeSleeping")}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${partner.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {partner.status === "ACTIVE" ? t("partners.statusActive") : t("partners.statusExited")}
            </span>
            {partner.phone && <span className="text-xs text-gray-400">{partner.phone}</span>}
          </div>

          {/* Balance row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-400">{t("partners.capitalBalance")}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatPaisa(partner.capitalBalancePaisa)}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-400">{t("partners.profitBalance")}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatPaisa(partner.profitBalancePaisa)}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-400">{t("partners.deferredLoss")}</p>
              <p className={`text-sm font-semibold mt-0.5 ${partner.deferredLossPaisa > 0 ? "text-red-600" : "text-gray-900"}`}>
                {formatPaisa(partner.deferredLossPaisa)}
              </p>
            </div>
          </div>

          <button
            onClick={openInjection}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
          >
            {t("partners.addInjection")}
          </button>

          {/* Ledger timeline */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("partners.ledgerTitle")}</p>
            {ledgerLoading ? (
              [1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
            ) : ledger.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t("partners.noLedgerEntries")}</p>
            ) : (
              <div className="space-y-1.5">
                {ledger.map((entry) => (
                  <div key={entry.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                          {t(ENTRY_TYPE_KEY[entry.entryType] ?? entry.entryType)}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatDate(entry.createdAt)}</span>
                      </div>
                      {entry.note && <p className="text-xs text-gray-500 mt-1">{entry.note}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{t("partners.capitalBalance")}: {formatPaisa(entry.balanceAfterPaisa)}</p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ${entry.amountPaisa >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {entry.amountPaisa >= 0 ? "+" : ""}{formatPaisa(entry.amountPaisa)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit partner */}
      <SlidePanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("common.edit")}
        footer={
          <>
            {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
            <button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || !editForm.name.trim()}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {editMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <input placeholder={t("partners.partnerName")} value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.partnerPhone")} value={editForm.phone} type="tel"
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t("partners.partnerTypeLabel")}</p>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden opacity-60 pointer-events-none">
              {(["MANAGING", "SLEEPING"] as const).map((type) => (
                <div key={type}
                  className={`flex-1 h-11 flex items-center justify-center text-sm font-medium ${editForm.partnerType === type ? "bg-indigo-600 text-white" : "bg-white text-gray-500"}`}>
                  {type === "MANAGING" ? t("partners.typeManaging") : t("partners.typeSleeping")}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{t("partners.typeImmutableHint")}</p>
          </div>

          <input placeholder={t("partners.joinDate")} value={editForm.joinDate} type="date"
            onChange={(e) => setEditForm((f) => ({ ...f, joinDate: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <textarea placeholder={t("partners.note")} value={editForm.note} rows={3}
            onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </SlidePanel>

      {/* Add capital injection */}
      <SlidePanel
        open={injectionOpen}
        onClose={() => setInjectionOpen(false)}
        title={t("partners.addInjection")}
        footer={
          <>
            {injectionError && <p className="text-xs text-red-600 mb-2">{injectionError}</p>}
            <button
              onClick={() => injectionMutation.mutate()}
              disabled={injectionMutation.isPending || !injectionForm.amountTaka}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {injectionMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <input placeholder={t("partners.injectionAmount")} value={injectionForm.amountTaka}
            type="number" inputMode="decimal"
            onChange={(e) => setInjectionForm((f) => ({ ...f, amountTaka: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.injectionLockInMonths")} value={injectionForm.lockInMonths}
            type="number" inputMode="numeric"
            onChange={(e) => setInjectionForm((f) => ({ ...f, lockInMonths: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <textarea placeholder={t("partners.injectionNote")} value={injectionForm.note} rows={3}
            onChange={(e) => setInjectionForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </SlidePanel>
    </div>
  );
}
