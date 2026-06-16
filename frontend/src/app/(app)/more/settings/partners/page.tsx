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

const EMPTY_FORM = {
  name: "",
  phone: "",
  partnerType: "SLEEPING" as PartnerType,
  joinDate: "",
  note: "",
};

export default function PartnersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => listPartners(),
  });

  const managing = partners.filter((p) => p.partnerType === "MANAGING");
  const sleeping = partners.filter((p) => p.partnerType === "SLEEPING");

  const openAdd = () => { setForm(EMPTY_FORM); setError(""); setOpen(true); };
  const close = () => { setOpen(false); setError(""); };

  const saveMutation = useMutation({
    mutationFn: () =>
      createPartner({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        partnerType: form.partnerType,
        joinDate: form.joinDate || undefined,
        note: form.note.trim() || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["partners"] }); close(); },
    onError: () => setError(t("partners.failedSavePartner")),
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
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {p.status === "ACTIVE" ? t("partners.statusActive") : t("partners.statusExited")}
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
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name.trim()}
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

          <textarea placeholder={t("partners.note")} value={form.note} rows={3}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </SlidePanel>
    </div>
  );
}
