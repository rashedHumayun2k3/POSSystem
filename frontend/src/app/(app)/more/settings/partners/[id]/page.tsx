"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPartner,
  updatePartner,
  listPartnerLedger,
  listCapitalInjections,
  recordCapitalInjection,
  updateCapitalInjection,
  deleteCapitalInjection,
  submitCapitalInjection,
  getCapitalInjectionApproval,
  castCapitalInjectionVote,
  getPartnerApproval,
  castApprovalVote,
  cancelPendingPartner,
  listPartners,
} from "@/lib/partnersApi";
import type { PartnerType, PaymentMethod, CapitalInjectionDto } from "@/types/partner";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatPaisa } from "@/lib/format";
import { ChevronDownIcon, PencilIcon } from "@heroicons/react/24/outline";
import SlidePanel from "@/components/ui/SlidePanel";
import ImageUploadField from "@/components/ui/ImageUploadField";
import { useToastStore } from "@/store/toastStore";
import { isBangladeshMobileNumber } from "@/lib/phone";
import { getErrorMessage } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { useAuthStore } from "@/store/authStore";
import { getStaff } from "@/lib/settingsApi";

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
  name: "", phone: "", photoUrl: null as string | null, linkedUserId: "", partnerType: "SLEEPING" as PartnerType, joinDate: "", note: "",
  nidNumber: "", address: "", email: "", bankAccountNumber: "", bankName: "",
  agreedProfitSharePct: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
};
const EMPTY_INJECTION_FORM = {
  amountTaka: "",
  injectedAt: new Date().toISOString().slice(0, 10),
  lockInMonths: "12",
  paymentMethod: "CASH" as PaymentMethod,
  paidTo: "",
  bankName: "",
  bankAccountNumber: "",
  chequeNumber: "",
  paymentReference: "",
  proofImageUrl: null as string | null,
  note: "",
};

const INJECTION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const INJECTION_STATUS_LABEL_KEY: Record<string, string> = {
  DRAFT: "partners.injectionStatusDraft",
  PENDING_APPROVAL: "partners.injectionStatusPending",
  APPROVED: "partners.injectionStatusApproved",
  REJECTED: "partners.injectionStatusRejected",
};

const PAYMENT_METHOD_LABEL_KEY: Record<string, string> = {
  CASH: "partners.paymentMethodCASH",
  BANK: "partners.paymentMethodBANK",
  CHEQUE: "partners.paymentMethodCHEQUE",
  MOBILE_BANKING: "partners.paymentMethodMOBILE_BANKING",
};

const getInjectionStatusPresentation = (status?: string) => {
  // Older API responses did not include status. Those records already affected the
  // ledger, so keep them approved/read-only while a stale response is still cached.
  const normalizedStatus = status || "APPROVED";
  return {
    badge: INJECTION_STATUS_BADGE[normalizedStatus] ?? "bg-gray-100 text-gray-600",
    labelKey: INJECTION_STATUS_LABEL_KEY[normalizedStatus],
    fallbackLabel: normalizedStatus.replaceAll("_", " "),
  };
};

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [editOpen, setEditOpen] = useState(false);
  const [personalInfoOpen, setPersonalInfoOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [injectionOpen, setInjectionOpen] = useState(false);
  const [injectionForm, setInjectionForm] = useState(EMPTY_INJECTION_FORM);
  const [editingInjectionId, setEditingInjectionId] = useState<string | null>(null);
  const [selectedInjectionId, setSelectedInjectionId] = useState<string | null>(null);

  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const editPhoneInvalid = Boolean(editForm.phone.trim()) && !isBangladeshMobileNumber(editForm.phone);
  const editEmergencyPhoneInvalid = Boolean(editForm.emergencyContactPhone.trim()) && !isBangladeshMobileNumber(editForm.emergencyContactPhone);
  const canSaveEdit = Boolean(
    editForm.name.trim() && editForm.nidNumber.trim() && editForm.address.trim() &&
    (editForm.partnerType !== "MANAGING" || editForm.linkedUserId)
  ) && !editPhoneInvalid && !editEmergencyPhoneInvalid;

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partners", id],
    queryFn: () => getPartner(id),
  });

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["partners", id, "ledger"],
    queryFn: () => listPartnerLedger(id),
  });

  const { data: injections = [], isLoading: injectionsLoading } = useQuery({
    queryKey: ["partners", id, "capital-injections"],
    queryFn: () => listCapitalInjections(id),
  });
  const selectedInjection = injections.find((injection) => injection.id === selectedInjectionId) ?? null;

  useEffect(() => {
    const requestedInjectionId = new URLSearchParams(window.location.search).get("injection");
    if (requestedInjectionId && injections.some((injection) => injection.id === requestedInjectionId)) {
      setSelectedInjectionId(requestedInjectionId);
    }
  }, [injections]);

  const closeInjectionDetails = () => {
    setSelectedInjectionId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("injection");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const { data: injectionApproval, isLoading: injectionApprovalLoading } = useQuery({
    queryKey: ["partners", id, "capital-injections", selectedInjectionId, "approval"],
    queryFn: () => getCapitalInjectionApproval(id, selectedInjectionId!),
    enabled: Boolean(selectedInjectionId),
  });

  const { data: approval } = useQuery({
    queryKey: ["partners", id, "approval"],
    queryFn: () => getPartnerApproval(id),
    enabled: partner?.status === "PENDING_APPROVAL",
  });

  const { data: managingPartners = [] } = useQuery({
    queryKey: ["partners", "MANAGING", "ACTIVE"],
    queryFn: () => listPartners({ partnerType: "MANAGING", status: "ACTIVE" }),
    enabled: partner?.status === "PENDING_APPROVAL" || injections.some((i) => i.status === "PENDING_APPROVAL") || Boolean(selectedInjectionId),
  });
  const { data: loginAccounts = [] } = useQuery({ queryKey: ["users"], queryFn: getStaff, enabled: currentUser?.role === "OWNER" });

  const openEdit = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      phone: partner.phone ?? "",
      photoUrl: partner.photoUrl,
      linkedUserId: partner.linkedUserId ?? "",
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
    setEditOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: () =>
      updatePartner(id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        photoUrl: editForm.photoUrl || undefined,
        linkedUserId: editForm.partnerType === "MANAGING" ? editForm.linkedUserId || undefined : undefined,
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
    onError: () => useToastStore.getState().show(t("partners.failedSavePartner"), "error"),
  });

  const voteMutation = useMutation({
    mutationFn: ({ votedByPartnerId, decision, note }: { votedByPartnerId: string; decision: "APPROVE" | "REJECT"; note?: string }) =>
      castApprovalVote(id, { decision, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      qc.invalidateQueries({ queryKey: ["partners", id, "approval"] });
    },
    onError: () => useToastStore.getState().show(t("partners.failedVote"), "error"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPendingPartner(id, { reason: cancelReason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: () => useToastStore.getState().show(t("partners.failedCancel"), "error"),
  });

  const openInjection = () => { setEditingInjectionId(null); setInjectionForm(EMPTY_INJECTION_FORM); setInjectionOpen(true); };
  const openEditInjection = (injection: CapitalInjectionDto) => {
    setEditingInjectionId(injection.id);
    setInjectionForm({
      amountTaka: (injection.amountPaisa / 100).toString(),
      injectedAt: injection.injectedAt.slice(0, 10),
      lockInMonths: injection.lockInMonths.toString(),
      paymentMethod: injection.paymentMethod,
      paidTo: injection.paidTo,
      bankName: injection.bankName ?? "",
      bankAccountNumber: injection.bankAccountNumber ?? "",
      chequeNumber: injection.chequeNumber ?? "",
      paymentReference: injection.paymentReference ?? "",
      proofImageUrl: injection.proofImageUrl,
      note: injection.note ?? "",
    });
    setInjectionOpen(true);
  };
  const needsBankDetails = injectionForm.paymentMethod === "BANK";
  const needsChequeDetails = injectionForm.paymentMethod === "CHEQUE";
  const canSaveInjection = Boolean(
    injectionForm.amountTaka &&
    injectionForm.injectedAt &&
    injectionForm.paidTo.trim() &&
    (!needsBankDetails || (injectionForm.bankName.trim() && injectionForm.bankAccountNumber.trim())) &&
    (!needsChequeDetails || injectionForm.chequeNumber.trim())
  );

  const injectionMutation = useMutation({
    mutationFn: () =>
      (editingInjectionId ? updateCapitalInjection(id, editingInjectionId, {
        amountPaisa: Math.round(parseFloat(injectionForm.amountTaka || "0") * 100),
        injectedAt: injectionForm.injectedAt || undefined,
        lockInMonths: parseInt(injectionForm.lockInMonths, 10) || 0,
        paymentMethod: injectionForm.paymentMethod,
        paidTo: injectionForm.paidTo.trim(),
        bankName: injectionForm.bankName.trim() || undefined,
        bankAccountNumber: injectionForm.bankAccountNumber.trim() || undefined,
        chequeNumber: injectionForm.chequeNumber.trim() || undefined,
        paymentReference: injectionForm.paymentReference.trim() || undefined,
        proofImageUrl: injectionForm.proofImageUrl || undefined,
        note: injectionForm.note.trim() || undefined,
      }) : recordCapitalInjection(id, {
        amountPaisa: Math.round(parseFloat(injectionForm.amountTaka || "0") * 100),
        injectedAt: injectionForm.injectedAt || undefined,
        lockInMonths: parseInt(injectionForm.lockInMonths, 10) || 0,
        paymentMethod: injectionForm.paymentMethod,
        paidTo: injectionForm.paidTo.trim(),
        bankName: injectionForm.bankName.trim() || undefined,
        bankAccountNumber: injectionForm.bankAccountNumber.trim() || undefined,
        chequeNumber: injectionForm.chequeNumber.trim() || undefined,
        paymentReference: injectionForm.paymentReference.trim() || undefined,
        proofImageUrl: injectionForm.proofImageUrl || undefined,
        note: injectionForm.note.trim() || undefined,
      })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners", id] });
      qc.invalidateQueries({ queryKey: ["partners", id, "ledger"] });
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections"] });
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections", selectedInjectionId, "approval"] });
      qc.invalidateQueries({ queryKey: ["partners"] });
      setInjectionOpen(false);
      setEditingInjectionId(null);
    },
    onError: () => useToastStore.getState().show(t("partners.failedSaveInjection"), "error"),
  });

  const submitInjectionMutation = useMutation({
    mutationFn: (injectionId: string) => submitCapitalInjection(id, injectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections"] });
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections", selectedInjectionId, "approval"] });
    },
    onError: () => useToastStore.getState().show(t("partners.failedSaveInjection"), "error"),
  });

  const deleteInjectionMutation = useMutation({
    mutationFn: (injectionId: string) => deleteCapitalInjection(id, injectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections"] });
    },
    onError: () => useToastStore.getState().show(t("partners.failedSaveInjection"), "error"),
  });

  const injectionVoteMutation = useMutation({
    mutationFn: ({ injectionId, votedByPartnerId, decision, note }: { injectionId: string; votedByPartnerId: string; decision: "APPROVE" | "REJECT"; note?: string }) =>
      castCapitalInjectionVote(id, injectionId, { decision, note }),
    onSuccess: (approvalStatus, variables) => {
      qc.setQueryData(
        ["partners", id, "capital-injections", variables.injectionId, "approval"],
        approvalStatus
      );
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partners", id] });
      qc.invalidateQueries({ queryKey: ["partners", id, "ledger"] });
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections"] });
      qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections", selectedInjectionId, "approval"] });
    },
    onError: async (error, variables) => {
      try {
        const currentApproval = await qc.fetchQuery({
          queryKey: ["partners", id, "capital-injections", variables.injectionId, "approval"],
          queryFn: () => getCapitalInjectionApproval(id, variables.injectionId),
        });
        const persistedVote = currentApproval.votes.find((vote) => vote.votedByPartnerId === variables.votedByPartnerId);
        if (persistedVote?.decision === variables.decision) {
          useToastStore.getState().show(t("partners.voteRecorded"), "success");
          qc.invalidateQueries({ queryKey: ["partners", id, "capital-injections"] });
          qc.invalidateQueries({ queryKey: ["partners", id, "ledger"] });
          return;
        }
      } catch {
        // Preserve the original request error when reconciliation cannot reach the API.
      }
      useToastStore.getState().show(getErrorMessage(error, t("partners.failedVote")), "error");
    },
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
        {partner && <Avatar name={partner.name} photoUrl={partner.photoUrl} size={32} />}
        <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">{partner?.name ?? "…"}</h1>
        {partner && currentUser?.role === "OWNER" && (
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

          <section className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-3">
            <button
              type="button"
              onClick={() => setPersonalInfoOpen((open) => !open)}
              aria-expanded={personalInfoOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <h2 className="text-sm font-semibold text-gray-900">{t("partners.personalInformation")}</h2>
              <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${personalInfoOpen ? "rotate-180" : ""}`} />
            </button>
            {personalInfoOpen && <div className="pt-3">
            {currentUser?.role === "OWNER" && (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={openEdit}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600"
                >
                  <PencilIcon className="h-4 w-4" />
                  {t("common.edit")}
                </button>
              </div>
            )}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              {[
                [t("partners.partnerName"), partner.name],
                [t("partners.partnerPhone"), partner.phone],
                [t("partners.email"), partner.email],
                [t("partners.nidNumber"), partner.nidNumber],
                [t("partners.address"), partner.address],
                [t("partners.joinDate"), partner.joinDate ? new Date(partner.joinDate).toLocaleDateString() : null],
                [t("partners.agreedProfitSharePct"), partner.agreedProfitSharePct != null ? `${partner.agreedProfitSharePct}%` : null],
                [t("partners.bankName"), partner.bankName],
                [t("partners.bankAccountNumber"), partner.bankAccountNumber],
                [t("partners.emergencyContactName"), partner.emergencyContactName],
                [t("partners.emergencyContactPhone"), partner.emergencyContactPhone],
                [t("partners.emergencyContactRelation"), partner.emergencyContactRelation],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] text-gray-400">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-gray-800">{value || t("partners.notProvided")}</dd>
                </div>
              ))}
            </dl>
            {partner.note && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-[11px] text-gray-400">{t("partners.note")}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{partner.note}</p>
              </div>
            )}
            </div>}
          </section>

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
              <div className="space-y-2">
                {managingPartners.map((mp) => {
                  const existingVote = approval?.votes.find((v) => v.votedByPartnerId === mp.id);
                  const canVote = mp.linkedUserId === currentUser?.id;
                  return (
                    <div key={mp.id} className="bg-white border border-amber-100 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-800">{mp.name}</span>
                        {existingVote ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${existingVote.decision === "APPROVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {existingVote.decision === "APPROVE" ? t("partners.approve") : t("partners.reject")}
                          </span>
                        ) : canVote ? (
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
                                if (!reason) { useToastStore.getState().show(t("partners.rejectReasonPlaceholder"), "error"); return; }
                                voteMutation.mutate({ votedByPartnerId: mp.id, decision: "REJECT", note: reason });
                              }}
                              disabled={voteMutation.isPending}
                              className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
                            >
                              {t("partners.reject")}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                            {t("partners.managerAwaiting")}
                          </span>
                        )}
                      </div>
                      {!existingVote && canVote && (
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
              {currentUser?.role === "OWNER" && (
                <button
                  onClick={() => { setCancelReason(""); setCancelOpen(true); }}
                  className="w-full h-9 rounded-lg border border-amber-300 text-amber-800 text-xs font-semibold"
                >
                  {t("partners.cancelRequest")}
                </button>
              )}
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

          {partner.status === "ACTIVE" && currentUser?.role === "OWNER" ? (
            <button
              onClick={openInjection}
              className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
            >
              {t("partners.addInjection")}
            </button>
          ) : partner.status !== "ACTIVE" ? (
            <p className="text-xs text-gray-400 text-center">{t("partners.injectionBlockedHint")}</p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("partners.injectionsTitle")}</p>
            {injectionsLoading ? (
              [1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
            ) : injections.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("partners.noInjections")}</p>
            ) : (
              <div className="space-y-2">
                {injections.map((injection) => {
                  const statusPresentation = getInjectionStatusPresentation(injection.status);
                  const paymentMethodLabelKey = PAYMENT_METHOD_LABEL_KEY[injection.paymentMethod];
                  return (
                  <div
                    key={injection.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedInjectionId(injection.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedInjectionId(injection.id); }}
                    className="bg-white border border-gray-100 rounded-xl px-3 py-3 space-y-2 cursor-pointer hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusPresentation.badge}`}>
                            {statusPresentation.labelKey ? t(statusPresentation.labelKey) : statusPresentation.fallbackLabel}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
                            {t(paymentMethodLabelKey ?? "partners.paymentMethodNotRecorded")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(injection.injectedAt)}{injection.paidTo ? ` · ${injection.paidTo}` : ""}
                        </p>
                        {injection.paymentReference && <p className="text-[10px] text-gray-400 mt-0.5">{injection.paymentReference}</p>}
                        {injection.rejectionReason && <p className="text-xs text-red-500 mt-1">{injection.rejectionReason}</p>}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 shrink-0">{formatPaisa(injection.amountPaisa)}</p>
                    </div>

                    {injection.status === "DRAFT" && (
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={(event) => { event.stopPropagation(); openEditInjection(injection); }} className="h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={(event) => { event.stopPropagation(); deleteInjectionMutation.mutate(injection.id); }}
                          disabled={deleteInjectionMutation.isPending}
                          className="h-9 rounded-lg border border-red-200 text-xs font-semibold text-red-600 disabled:opacity-40"
                        >
                          {t("common.delete")}
                        </button>
                        <button
                          onClick={(event) => { event.stopPropagation(); submitInjectionMutation.mutate(injection.id); }}
                          disabled={submitInjectionMutation.isPending}
                          className="h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40"
                        >
                          {t("partners.sendForApproval")}
                        </button>
                      </div>
                    )}

                    {injection.status === "PENDING_APPROVAL" && (
                      <p className="text-xs text-amber-700">{t("partners.tapToViewApproval")}</p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

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
            <button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || !canSaveEdit}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {editMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <ImageUploadField
            value={editForm.photoUrl}
            onChange={(photoUrl) => setEditForm((current) => ({ ...current, photoUrl }))}
            label={t("partners.partnerPhoto")}
            uploadingLabel={t("settings.logoUploading")}
            errorLabel={t("settings.logoUploadFailed")}
            removeLabel={t("settings.logoRemove")}
            capture="user"
          />
          <input placeholder={t("partners.partnerName")} value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.partnerPhone")} value={editForm.phone} type="tel"
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            pattern="(?:\+?88)?01[3-9][0-9]{8}"
            title={t("partners.invalidPhone")}
            className={`w-full h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${editPhoneInvalid ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
          {editPhoneInvalid && <p className="text-xs text-red-500 -mt-2">{t("partners.invalidPhone")}</p>}

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
            <p className="mt-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs leading-5 text-indigo-800">
              {editForm.partnerType === "MANAGING" ? t("partners.typeManagingDesc") : t("partners.typeSleepingDesc")}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{t("partners.typeImmutableHint")}</p>
          </div>

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.joinDate")}</span>
            <input value={editForm.joinDate} type="date"
              onChange={(e) => setEditForm((f) => ({ ...f, joinDate: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

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
            pattern="(?:\+?88)?01[3-9][0-9]{8}"
            title={t("partners.invalidPhone")}
            className={`w-full h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${editEmergencyPhoneInvalid ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
          {editEmergencyPhoneInvalid && <p className="text-xs text-red-500 -mt-2">{t("partners.invalidPhone")}</p>}
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

      {/* Capital installment details and approval trail */}
      <SlidePanel
        open={Boolean(selectedInjection)}
        onClose={closeInjectionDetails}
        title={t("partners.injectionDetailsTitle")}
      >
        {selectedInjection && (() => {
          const statusPresentation = getInjectionStatusPresentation(selectedInjection.status);
          const paymentMethodLabelKey = PAYMENT_METHOD_LABEL_KEY[selectedInjection.paymentMethod];
          return (
            <div className="px-4 py-4 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium ${statusPresentation.badge}`}>
                    {statusPresentation.labelKey ? t(statusPresentation.labelKey) : statusPresentation.fallbackLabel}
                  </span>
                  <p className="text-xs text-gray-500">{formatDate(selectedInjection.injectedAt)}</p>
                </div>
                <p className="text-xl font-semibold text-gray-900">{formatPaisa(selectedInjection.amountPaisa)}</p>
              </div>

              <div className="divide-y divide-gray-100 border-y border-gray-100">
                {[
                  [t("partners.injectionPaymentMethodLabel"), t(paymentMethodLabelKey ?? "partners.paymentMethodNotRecorded")],
                  [t("partners.injectionPaidToLabel"), selectedInjection.paidTo || t("partners.paymentMethodNotRecorded")],
                  [t("partners.injectionLockInLabel"), t("partners.monthCount", { count: selectedInjection.lockInMonths })],
                  [t("partners.injectionLockInUntil"), formatDate(selectedInjection.lockInExpiresAt)],
                  ...(selectedInjection.bankName ? [[t("partners.injectionBankNameLabel"), selectedInjection.bankName]] : []),
                  ...(selectedInjection.bankAccountNumber ? [[t("partners.injectionBankAccountLabel"), selectedInjection.bankAccountNumber]] : []),
                  ...(selectedInjection.chequeNumber ? [[t("partners.injectionChequeNumberLabel"), selectedInjection.chequeNumber]] : []),
                  ...(selectedInjection.paymentReference ? [[t("partners.injectionReferenceLabel"), selectedInjection.paymentReference]] : []),
                  ...(selectedInjection.note ? [[t("partners.injectionNoteLabel"), selectedInjection.note]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 py-2.5 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-900 text-right break-words">{value}</span>
                  </div>
                ))}
              </div>

              {selectedInjection.proofImageUrl && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">{t("partners.injectionProofLabel")}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedInjection.proofImageUrl} alt={t("partners.injectionProofLabel")} className="w-full max-h-64 object-contain border border-gray-200 rounded-lg bg-gray-50" />
                </div>
              )}

              {selectedInjection.status !== "DRAFT" && (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t("partners.approvalStatusTitle")}</h3>
                    {injectionApprovalLoading ? (
                      <div className="h-4 w-48 mt-2 bg-gray-100 rounded animate-pulse" />
                    ) : injectionApproval ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {t("partners.approvalProgress", { approved: injectionApproval.approveCount, total: injectionApproval.activeManagingPartnerCount, required: injectionApproval.requiredVotes })}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {managingPartners.map((manager) => {
                      const vote = injectionApproval?.votes.find((item) => item.votedByPartnerId === manager.id);
                      const reasonKey = `${selectedInjection.id}:${manager.id}`;
                      return (
                        <div key={manager.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{manager.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${vote?.decision === "APPROVE" ? "bg-green-100 text-green-700" : vote?.decision === "REJECT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {vote?.decision === "APPROVE"
                                ? t("partners.managerApproved")
                                : vote?.decision === "REJECT"
                                  ? t("partners.managerRejected")
                                  : t(selectedInjection.status === "PENDING_APPROVAL" ? "partners.managerAwaiting" : "partners.managerNoDecision")}
                            </span>
                          </div>
                          {vote && <p className="text-xs text-gray-400">{formatDate(vote.votedAt)}</p>}
                          {vote?.note && <p className="text-xs text-gray-600">{vote.note}</p>}

                          {!vote && selectedInjection.status === "PENDING_APPROVAL" && manager.linkedUserId === currentUser?.id && (
                            <>
                              <input
                                placeholder={t("partners.rejectReasonPlaceholder")}
                                value={rejectReasons[reasonKey] ?? ""}
                                onChange={(event) => setRejectReasons((reasons) => ({ ...reasons, [reasonKey]: event.target.value }))}
                                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => injectionVoteMutation.mutate({ injectionId: selectedInjection.id, votedByPartnerId: manager.id, decision: "APPROVE" })}
                                  disabled={injectionVoteMutation.isPending}
                                  className="h-9 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-40"
                                >
                                  {t("partners.approve")}
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = (rejectReasons[reasonKey] ?? "").trim();
                                    if (!reason) { useToastStore.getState().show(t("partners.rejectReasonPlaceholder"), "error"); return; }
                                    injectionVoteMutation.mutate({ injectionId: selectedInjection.id, votedByPartnerId: manager.id, decision: "REJECT", note: reason });
                                  }}
                                  disabled={injectionVoteMutation.isPending}
                                  className="h-9 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
                                >
                                  {t("partners.reject")}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selectedInjection.status === "PENDING_APPROVAL" && !managingPartners.some((manager) => manager.linkedUserId === currentUser?.id) && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {t("partners.currentLoginNotLinked")}
                    </p>
                  )}
                </section>
              )}

              {selectedInjection.status === "DRAFT" && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setSelectedInjectionId(null); openEditInjection(selectedInjection); }} className="h-11 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700">
                    {t("common.edit")}
                  </button>
                  <button onClick={() => submitInjectionMutation.mutate(selectedInjection.id)} disabled={submitInjectionMutation.isPending} className="h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">
                    {t("partners.sendForApproval")}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </SlidePanel>

      {/* Add capital injection */}
      <SlidePanel
        open={injectionOpen}
        onClose={() => setInjectionOpen(false)}
        title={t("partners.addInjection")}
        footer={
          <>
            <button
              onClick={() => injectionMutation.mutate()}
              disabled={injectionMutation.isPending || !canSaveInjection}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {injectionMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionAmount")}</span>
            <input value={injectionForm.amountTaka}
              type="number" inputMode="decimal" min="0"
              onChange={(e) => setInjectionForm((f) => ({ ...f, amountTaka: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionPaidDate")}</span>
            <input value={injectionForm.injectedAt} type="date"
              onChange={(e) => setInjectionForm((f) => ({ ...f, injectedAt: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t("partners.injectionPaymentMethod")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["CASH", "BANK", "CHEQUE", "MOBILE_BANKING"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setInjectionForm((f) => ({ ...f, paymentMethod: method }))}
                  className={`h-10 rounded-xl border text-xs font-semibold ${injectionForm.paymentMethod === method ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}
                >
                  {t(`partners.paymentMethod${method}`)}
                </button>
              ))}
            </div>
          </div>

          {editForm.partnerType === "MANAGING" && (
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1.5">{t("partners.linkedLoginAccount")}</span>
              <select value={editForm.linkedUserId} onChange={(event) => setEditForm((current) => ({ ...current, linkedUserId: event.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">{t("partners.selectLoginAccount")}</option>
                {loginAccounts.filter((account) => account.isActive && (account.role === "OWNER" || account.role === "MANAGER" || account.role === "PARTNER")).map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · {account.phone}</option>
                ))}
              </select>
              <span className="block text-xs text-gray-400 mt-1">{t("partners.linkedLoginHelp")}</span>
            </label>
          )}

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionPaidTo")}</span>
            <input value={injectionForm.paidTo}
              onChange={(e) => setInjectionForm((f) => ({ ...f, paidTo: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

          {needsBankDetails && (
            <>
              <label className="block">
                <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionBankName")}</span>
                <input value={injectionForm.bankName}
                  onChange={(e) => setInjectionForm((f) => ({ ...f, bankName: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionBankAccount")}</span>
                <input value={injectionForm.bankAccountNumber}
                  onChange={(e) => setInjectionForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
            </>
          )}

          {needsChequeDetails && (
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionChequeNumber")}</span>
              <input value={injectionForm.chequeNumber}
                onChange={(e) => setInjectionForm((f) => ({ ...f, chequeNumber: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
          )}

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionReference")}</span>
            <input value={injectionForm.paymentReference}
              onChange={(e) => setInjectionForm((f) => ({ ...f, paymentReference: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionLockInMonths")}</span>
            <input value={injectionForm.lockInMonths}
              type="number" inputMode="numeric" min="0"
              onChange={(e) => setInjectionForm((f) => ({ ...f, lockInMonths: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="block text-xs text-gray-400 mt-1">{t("partners.injectionLockInHelp")}</span>
          </label>

          <ImageUploadField
            value={injectionForm.proofImageUrl}
            onChange={(url) => setInjectionForm((f) => ({ ...f, proofImageUrl: url }))}
            label={t("partners.injectionProof")}
            uploadingLabel={t("settings.logoUploading")}
            errorLabel={t("settings.logoUploadFailed")}
            removeLabel={t("settings.logoRemove")}
          />

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.injectionNote")}</span>
            <textarea value={injectionForm.note} rows={3}
              onChange={(e) => setInjectionForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
        </div>
      </SlidePanel>
    </div>
  );
}
