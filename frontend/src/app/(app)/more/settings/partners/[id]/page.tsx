"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPartner,
  updatePartner,
  listPartnerLedger,
  recordCapitalInjection,
  getPartnerApproval,
  castApprovalVote,
  cancelPendingPartner,
  listPartners,
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

const EMPTY_EDIT_FORM = {
  name: "", phone: "", partnerType: "SLEEPING" as PartnerType, joinDate: "", note: "",
  nidNumber: "", address: "", email: "", bankAccountNumber: "", bankName: "",
  agreedProfitSharePct: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
};
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

  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [voteError, setVoteError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partners", id],
    queryFn: () => getPartner(id),
  });

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["partners", id, "ledger"],
    queryFn: () => listPartnerLedger(id),
  });

  const { data: approval } = useQuery({
    queryKey: ["partners", id, "approval"],
    queryFn: () => getPartnerApproval(id),
    enabled: partner?.status === "PENDING_APPROVAL",
  });

  const { data: managingPartners = [] } = useQuery({
    queryKey: ["partners", "MANAGING", "ACTIVE"],
    queryFn: () => listPartners({ partnerType: "MANAGING", status: "ACTIVE" }),
    enabled: partner?.status === "PENDING_APPROVAL",
  });

  const openEdit = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      phone: partner.phone ?? "",
      partnerType: partner.partnerType,
      joinDate: partner.joinDate ? partner.joinDate.slice(0, 10) : "",
      note: partner.note ?? "",
      nidNumber: partner.nidNumber ?? "",
      address: partner.address ?? "",
      email: partner.email ?? "",
      bankAccountNumber: partner.bankAccountNumber ?? "",
      bankName: partner.bankName ?? "",
      agreedProfitSharePct: partner.agreedProfitSharePct?.toString() ?? "",
      emergencyContactName: partner.emergencyContactName ?? "",
      emergencyContactPhone: partner.emergencyContactPhone ?? "",
      emergencyContactRelation: partner.emergencyContactRelation ?? "",
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
        nidNumber: editForm.nidNumber.trim(),
        address: editForm.address.trim(),
        email: editForm.email.trim() || undefined,
        bankAccountNumber: editForm.bankAccountNumber.trim() || undefined,
        bankName: editForm.bankName.trim() || undefined,
        agreedProfitSharePct: editForm.agreedProfitSharePct ? parseFloat(editForm.agreedProfitSharePct) : undefined,
        emergencyContactName: editForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: editForm.emergencyContactPhone.trim() || undefined,
        emergencyContactRelation: editForm.emergencyContactRelation.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      setEditOpen(false);
    },
    onError: () => setEditError(t("partners.failedSavePartner")),
  });

  const voteMutation = useMutation({
    mutationFn: ({ votedByPartnerId, decision, note }: { votedByPartnerId: string; decision: "APPROVE" | "REJECT"; note?: string }) =>
      castApprovalVote(id, { votedByPartnerId, decision, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      qc.invalidateQueries({ queryKey: ["partners", id, "approval"] });
      setVoteError("");
    },
    onError: () => setVoteError(t("partners.failedVote")),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPendingPartner(id, { reason: cancelReason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: () => setCancelError(t("partners.failedCancel")),
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
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[partner.status]}`}>
              {t(STATUS_LABEL_KEY[partner.status])}
            </span>
            {partner.phone && <span className="text-xs text-gray-400">{partner.phone}</span>}
          </div>

          {/* Approval panel (R15.11) — only while pending */}
          {partner.status === "PENDING_APPROVAL" && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-amber-800">{t("partners.pendingBanner")}</p>
              {approval && (
                <p className="text-xs text-amber-700">
                  {t("partners.approvalProgress", {
                    approved: approval.approveCount,
                    total: approval.activeManagingPartnerCount,
                    required: approval.requiredVotes,
                  })}
                </p>
              )}
              {voteError && <p className="text-xs text-red-600">{voteError}</p>}
              <div className="space-y-2">
                {managingPartners.map((mp) => {
                  const existingVote = approval?.votes.find((v) => v.votedByPartnerId === mp.id);
                  return (
                    <div key={mp.id} className="bg-white border border-amber-100 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-800">{mp.name}</span>
                        {existingVote ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${existingVote.decision === "APPROVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {existingVote.decision === "APPROVE" ? t("partners.approve") : t("partners.reject")}
                          </span>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => voteMutation.mutate({ votedByPartnerId: mp.id, decision: "APPROVE" })}
                              disabled={voteMutation.isPending}
                              className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-40"
                            >
                              {t("partners.approve")}
                            </button>
                            <button
                              onClick={() => {
                                const reason = (rejectReasons[mp.id] ?? "").trim();
                                if (!reason) { setVoteError(t("partners.rejectReasonPlaceholder")); return; }
                                voteMutation.mutate({ votedByPartnerId: mp.id, decision: "REJECT", note: reason });
                              }}
                              disabled={voteMutation.isPending}
                              className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
                            >
                              {t("partners.reject")}
                            </button>
                          </div>
                        )}
                      </div>
                      {!existingVote && (
                        <input
                          placeholder={t("partners.rejectReasonPlaceholder")}
                          value={rejectReasons[mp.id] ?? ""}
                          onChange={(e) => setRejectReasons((r) => ({ ...r, [mp.id]: e.target.value }))}
                          className="w-full mt-2 h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => { setCancelReason(""); setCancelError(""); setCancelOpen(true); }}
                className="w-full h-9 rounded-lg border border-amber-300 text-amber-800 text-xs font-semibold"
              >
                {t("partners.cancelRequest")}
              </button>
            </div>
          )}

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

          {partner.status === "ACTIVE" ? (
            <button
              onClick={openInjection}
              className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
            >
              {t("partners.addInjection")}
            </button>
          ) : (
            <p className="text-xs text-gray-400 text-center">{t("partners.injectionBlockedHint")}</p>
          )}

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
              disabled={editMutation.isPending || !editForm.name.trim() || !editForm.nidNumber.trim() || !editForm.address.trim()}
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

          <input placeholder={t("partners.nidNumber")} value={editForm.nidNumber}
            onChange={(e) => setEditForm((f) => ({ ...f, nidNumber: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.address")} value={editForm.address}
            onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.email")} value={editForm.email} type="email"
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.bankAccountNumber")} value={editForm.bankAccountNumber}
            onChange={(e) => setEditForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.bankName")} value={editForm.bankName}
            onChange={(e) => setEditForm((f) => ({ ...f, bankName: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.agreedProfitSharePct")} value={editForm.agreedProfitSharePct}
            type="number" inputMode="decimal"
            onChange={(e) => setEditForm((f) => ({ ...f, agreedProfitSharePct: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.emergencyContactName")} value={editForm.emergencyContactName}
            onChange={(e) => setEditForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.emergencyContactPhone")} value={editForm.emergencyContactPhone} type="tel"
            onChange={(e) => setEditForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.emergencyContactRelation")} value={editForm.emergencyContactRelation}
            onChange={(e) => setEditForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <textarea placeholder={t("partners.note")} value={editForm.note} rows={3}
            onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </SlidePanel>

      {/* Cancel pending partner request (R15.11 — Owner escape hatch) */}
      <SlidePanel
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t("partners.cancelRequest")}
        footer={
          <>
            {cancelError && <p className="text-xs text-red-600 mb-2">{cancelError}</p>}
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              className="w-full h-12 rounded-xl bg-red-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {cancelMutation.isPending ? t("common.saving") : t("partners.cancelRequest")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <textarea placeholder={t("partners.cancelReasonPlaceholder")} value={cancelReason} rows={3}
            onChange={(e) => setCancelReason(e.target.value)}
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
