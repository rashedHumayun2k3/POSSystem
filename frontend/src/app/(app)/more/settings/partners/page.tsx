"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPartners, createPartner } from "@/lib/partnersApi";
import type { PartnerDto, PartnerType } from "@/types/partner";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatPaisa } from "@/lib/format";
import SlidePanel from "@/components/ui/SlidePanel";
import { useToastStore } from "@/store/toastStore";

const EMPTY_FORM = {
  name: "",
  phone: "",
  partnerType: "SLEEPING" as PartnerType,
  joinDate: "",
  note: "",
  nidNumber: "",
  address: "",
  email: "",
  bankAccountNumber: "",
  bankName: "",
  agreedProfitSharePct: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
  EXITED: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  ACTIVE: "partners.statusActive",
  PENDING_APPROVAL: "partners.statusPending",
  REJECTED: "partners.statusRejected",
  EXITED: "partners.statusExited",
};

export default function PartnersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => listPartners(),
  });

  const managing = partners.filter((p) => p.partnerType === "MANAGING");
  const sleeping = partners.filter((p) => p.partnerType === "SLEEPING");

  const openAdd = () => { setForm(EMPTY_FORM); setOpen(true); };
  const close = () => setOpen(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      createPartner({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        partnerType: form.partnerType,
        joinDate: form.joinDate || undefined,
        note: form.note.trim() || undefined,
        nidNumber: form.nidNumber.trim(),
        address: form.address.trim(),
        email: form.email.trim() || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        agreedProfitSharePct: form.agreedProfitSharePct ? parseFloat(form.agreedProfitSharePct) : undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["partners"] }); close(); },
    onError: () => useToastStore.getState().show(t("partners.failedSavePartner"), "error"),
  });

  const renderCard = (p: PartnerDto) => (
    <Link
      key={p.id}
      href={`/more/settings/partners/${p.id}`}
      className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 active:scale-[0.99] transition"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{p.name}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status]}`}>
            {t(STATUS_LABEL_KEY[p.status])}
          </span>
        </div>
        {p.phone && <p className="text-xs text-gray-400 mt-0.5">{p.phone}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          <span className="text-xs text-gray-500">{t("partners.capitalBalance")}: {formatPaisa(p.capitalBalancePaisa)}</span>
          {p.deferredLossPaisa > 0 && (
            <span className="text-xs text-red-600 font-medium">{t("partners.deferredLoss")}: {formatPaisa(p.deferredLossPaisa)}</span>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t("partners.title")}</h1>
        <button onClick={openAdd} className="text-sm font-semibold text-indigo-600">{t("partners.addPartner")}</button>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : partners.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t("partners.noPartners")}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("partners.sectionManaging")}</p>
              <div className="space-y-2">{managing.map(renderCard)}</div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("partners.sectionSleeping")}</p>
              <div className="space-y-2">{sleeping.map(renderCard)}</div>
            </div>
          </>
        )}
      </div>

      <SlidePanel
        open={open}
        onClose={close}
        title={t("partners.addPartner")}
        footer={
          <>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name.trim() || !form.nidNumber.trim() || !form.address.trim()}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <input placeholder={t("partners.partnerName")} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.partnerPhone")} value={form.phone} type="tel"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t("partners.partnerTypeLabel")}</p>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(["MANAGING", "SLEEPING"] as const).map((type) => (
                <button key={type} type="button"
                  onClick={() => setForm((f) => ({ ...f, partnerType: type }))}
                  className={`flex-1 h-11 text-sm font-medium transition-colors ${form.partnerType === type ? "bg-indigo-600 text-white" : "bg-white text-gray-500"}`}>
                  {type === "MANAGING" ? t("partners.typeManaging") : t("partners.typeSleeping")}
                </button>
              ))}
            </div>
          </div>

          <input placeholder={t("partners.joinDate")} value={form.joinDate} type="date"
            onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <input placeholder={t("partners.nidNumber")} value={form.nidNumber}
            onChange={(e) => setForm((f) => ({ ...f, nidNumber: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.address")} value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.email")} value={form.email} type="email"
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.bankAccountNumber")} value={form.bankAccountNumber}
            onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.bankName")} value={form.bankName}
            onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.agreedProfitSharePct")} value={form.agreedProfitSharePct}
            type="number" inputMode="decimal"
            onChange={(e) => setForm((f) => ({ ...f, agreedProfitSharePct: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.emergencyContactName")} value={form.emergencyContactName}
            onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.emergencyContactPhone")} value={form.emergencyContactPhone} type="tel"
            onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.emergencyContactRelation")} value={form.emergencyContactRelation}
            onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <textarea placeholder={t("partners.note")} value={form.note} rows={3}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </SlidePanel>
    </div>
  );
}
