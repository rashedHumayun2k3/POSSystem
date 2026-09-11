"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPartners, createPartner, listPendingCapitalInjections } from "@/lib/partnersApi";
import type { PartnerDto, PartnerType } from "@/types/partner";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatPaisa } from "@/lib/format";
import SlidePanel from "@/components/ui/SlidePanel";
import { useToastStore } from "@/store/toastStore";
import { isBangladeshMobileNumber } from "@/lib/phone";
import { PlusIcon } from "@heroicons/react/24/outline";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Avatar from "@/components/ui/Avatar";
import { getStaff } from "@/lib/settingsApi";
import { useAuthStore } from "@/store/authStore";

const getToday = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

const EMPTY_FORM = {
  name: "",
  phone: "",
  photoUrl: null as string | null,
  linkedUserId: "",
  accountMode: "CREATE" as "CREATE" | "LINK",
  loginPhone: "",
  loginEmail: "",
  temporaryPassword: "",
  confirmPassword: "",
  ownerAccessAuthorized: false,
  canAccessPos: false,
  partnerType: "" as PartnerType | "",
  joinDate: getToday(),
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

const PAYMENT_METHOD_LABEL_KEY: Record<string, string> = {
  CASH: "partners.paymentMethodCASH",
  BANK: "partners.paymentMethodBANK",
  CHEQUE: "partners.paymentMethodCHEQUE",
  MOBILE_BANKING: "partners.paymentMethodMOBILE_BANKING",
};

export default function PartnersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isOwner = currentUser?.role === "OWNER";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => listPartners(),
  });

  const { data: pendingInjections = [] } = useQuery({
    queryKey: ["partners", "capital-injections", "awaiting-approval"],
    queryFn: listPendingCapitalInjections,
  });
  const { data: loginAccounts = [] } = useQuery({ queryKey: ["users"], queryFn: getStaff, enabled: isOwner });

  const managing = partners.filter((p) => p.partnerType === "MANAGING");
  const sleeping = partners.filter((p) => p.partnerType === "SLEEPING");

  const openAdd = () => { setForm(EMPTY_FORM); setOpen(true); };
  const openAddMyself = () => {
    if (!currentUser) return;
    setForm({
      ...EMPTY_FORM,
      partnerType: "MANAGING",
      accountMode: "LINK",
      linkedUserId: currentUser.id,
      name: currentUser.name,
      phone: currentUser.phone ?? "",
      email: currentUser.email ?? "",
      photoUrl: currentUser.photoUrl ?? null,
    });
    setOpen(true);
  };
  const selectAccountMode = (mode: "CREATE" | "LINK") => {
    setForm((current) => ({ ...current, accountMode: mode, linkedUserId: "" }));
  };
  const close = () => setOpen(false);
  const phoneInvalid = Boolean(form.phone.trim()) && !isBangladeshMobileNumber(form.phone);
  const emergencyPhoneInvalid = Boolean(form.emergencyContactPhone.trim()) && !isBangladeshMobileNumber(form.emergencyContactPhone);
  const canSave = Boolean(
    form.name.trim() && form.partnerType && form.nidNumber.trim() && form.address.trim() &&
    (form.partnerType !== "MANAGING" || form.ownerAccessAuthorized) &&
    (form.partnerType !== "MANAGING" || (
      form.accountMode === "LINK"
        ? form.linkedUserId
        : isBangladeshMobileNumber(form.loginPhone) && form.temporaryPassword.length >= 8 && form.temporaryPassword === form.confirmPassword
    ))
  ) && !phoneInvalid && !emergencyPhoneInvalid;

  const saveMutation = useMutation({
    mutationFn: () =>
      createPartner({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        photoUrl: form.photoUrl || undefined,
        linkedUserId: form.partnerType === "MANAGING" ? form.linkedUserId || undefined : undefined,
        loginPhone: form.partnerType === "MANAGING" && form.accountMode === "CREATE" ? form.loginPhone.trim() : undefined,
        loginEmail: form.partnerType === "MANAGING" && form.accountMode === "CREATE" ? form.loginEmail.trim() || undefined : undefined,
        temporaryPassword: form.partnerType === "MANAGING" && form.accountMode === "CREATE" ? form.temporaryPassword : undefined,
        canAccessPos: form.partnerType === "MANAGING" && form.canAccessPos,
        partnerType: form.partnerType as PartnerType,
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
      <Avatar name={p.name} photoUrl={p.photoUrl} size={42} />
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
        {isOwner && partners.length > 0 && <button onClick={openAdd} className="flex items-center gap-1 text-sm font-semibold text-indigo-600">
          <PlusIcon className="w-4 h-4" />
          {t("partners.addPartner")}
        </button>}
      </div>

      <div className="px-4 pt-4 space-y-5">
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : partners.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">{t("partners.noPartners")}</p>
            {isOwner && (
              <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5">
                <button
                  type="button"
                  onClick={openAddMyself}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white"
                >
                  <PlusIcon className="h-4 w-4" />
                  {t("partners.addMyselfAsPartner")}
                </button>
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                >
                  <PlusIcon className="h-4 w-4" />
                  {t("partners.addAnotherPartner")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {pendingInjections.length > 0 && <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("partners.awaitingInstallmentApprovalTitle")}</p>
                <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                  {pendingInjections.length}
                </span>
              </div>
              <div className="space-y-2">
                  {pendingInjections.map((injection) => {
                    const injectionPartner = partners.find((partner) => partner.id === injection.partnerId);
                    return (
                      <Link
                        key={injection.id}
                        href={`/more/settings/partners/${injection.partnerId}?injection=${injection.id}`}
                        className="flex items-center gap-3 bg-white border border-amber-100 rounded-xl px-4 py-3 active:scale-[0.99] transition hover:border-amber-200"
                      >
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{injectionPartner?.name ?? t("partners.unknownPartner")}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t(PAYMENT_METHOD_LABEL_KEY[injection.paymentMethod] ?? "partners.paymentMethodNotRecorded")} · {new Date(injection.injectedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{formatPaisa(injection.amountPaisa)}</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">{t("partners.injectionStatusPending")}</p>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>}
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
              disabled={saveMutation.isPending || !canSave}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {t("partners.requiredFieldsHelp")}
          </p>
          <ImageUploadField
            value={form.photoUrl}
            onChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))}
            label={t("partners.partnerPhoto")}
            uploadingLabel={t("settings.logoUploading")}
            errorLabel={t("settings.logoUploadFailed")}
            removeLabel={t("settings.logoRemove")}
            capture="user"
          />
          <input placeholder={t("partners.partnerName")} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder={t("partners.partnerPhone")} value={form.phone} type="tel"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            pattern="(?:\+?88)?01[3-9][0-9]{8}"
            title={t("partners.invalidPhone")}
            className={`w-full h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${phoneInvalid ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
          {phoneInvalid && <p className="text-xs text-red-500 -mt-2">{t("partners.invalidPhone")}</p>}

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
            {form.partnerType && (
              <p className="mt-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs leading-5 text-indigo-800">
                {form.partnerType === "MANAGING" ? t("partners.typeManagingDesc") : t("partners.typeSleepingDesc")}
              </p>
            )}
            {form.partnerType === "SLEEPING" && (
              <p className="mt-2 text-xs leading-5 text-amber-700">{t("partners.sleepingLoginHelp")}</p>
            )}
          </div>

          {form.partnerType && <>
          {form.partnerType === "MANAGING" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 rounded-xl border border-gray-200 overflow-hidden">
                {(["CREATE", "LINK"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => selectAccountMode(mode)}
                    className={`h-10 text-xs font-semibold ${form.accountMode === mode ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}>
                    {t(mode === "CREATE" ? "partners.createLoginAccount" : "partners.linkExistingAccount")}
                  </button>
                ))}
              </div>
              {form.accountMode === "LINK" ? (
                <label className="block">
                  <span className="block text-xs text-gray-500 mb-1.5">{t("partners.linkedLoginAccount")}</span>
                  <select value={form.linkedUserId} onChange={(event) => setForm((current) => ({ ...current, linkedUserId: event.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">{t("partners.selectLoginAccount")}</option>
                    {loginAccounts.filter((account) => account.isActive && (account.role === "OWNER" || account.role === "MANAGER" || account.role === "PARTNER")).map((account) => (
                      <option key={account.id} value={account.id}>{account.name} · {account.phone}</option>
                    ))}
                  </select>
                  <span className="block text-xs text-gray-400 mt-1">{t("partners.linkedLoginHelp")}</span>
                </label>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-lg bg-green-50 px-3 py-2 text-xs leading-5 text-green-800">
                    {t("partners.loginCredentialsHelp")}
                  </p>
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1.5">{t("partners.loginPhone")}</span>
                    <input type="tel" value={form.loginPhone} onChange={(event) => setForm((current) => ({ ...current, loginPhone: event.target.value }))} className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm" />
                    <span className="mt-1.5 block text-xs leading-5 text-amber-700">{t("partners.loginPhoneWarning")}</span>
                  </label>
                  <label className="block"><span className="block text-xs text-gray-500 mb-1.5">{t("partners.loginEmail")}</span><input type="email" value={form.loginEmail} onChange={(event) => setForm((current) => ({ ...current, loginEmail: event.target.value }))} className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm" /></label>
                  <label className="block"><span className="block text-xs text-gray-500 mb-1.5">{t("partners.temporaryPassword")}</span><input type="password" value={form.temporaryPassword} onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))} className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm" /></label>
                  <label className="block"><span className="block text-xs text-gray-500 mb-1.5">{t("partners.confirmPassword")}</span><input type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm" /></label>
                  {form.temporaryPassword && form.temporaryPassword.length < 8 && <p className="text-xs text-red-500">{t("partners.passwordMinimum")}</p>}
                  {form.confirmPassword && form.temporaryPassword !== form.confirmPassword && <p className="text-xs text-red-500">{t("partners.passwordMismatch")}</p>}
                </div>
              )}
            </div>
          )}

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5">{t("partners.joinDate")}</span>
            <input value={form.joinDate} type="date"
              onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

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
            pattern="(?:\+?88)?01[3-9][0-9]{8}"
            title={t("partners.invalidPhone")}
            className={`w-full h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${emergencyPhoneInvalid ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
          {emergencyPhoneInvalid && <p className="text-xs text-red-500 -mt-2">{t("partners.invalidPhone")}</p>}
          <input placeholder={t("partners.emergencyContactRelation")} value={form.emergencyContactRelation}
            onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          {form.partnerType === "MANAGING" && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-3">
              <h3 className="text-sm font-semibold text-red-900">{t("partners.ownerAccessTitle")}</h3>
              <p className="mt-1 text-xs leading-5 text-red-800">{t("partners.ownerAccessWarning")}</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-700">
                <li>• {t("partners.ownerAccessSales")}</li>
                <li>• {t("partners.ownerAccessPurchases")}</li>
                <li>• {t("partners.ownerAccessFinance")}</li>
                <li>• {t("partners.ownerAccessAdministration")}</li>
              </ul>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.canAccessPos}
                  onChange={(event) => setForm((current) => ({ ...current, canAccessPos: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <span className="block text-xs font-semibold text-gray-900">{t("partners.posAccessLabel")}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-gray-500">{t("partners.posAccessHelp")}</span>
                </span>
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-red-200 pt-3">
                <input
                  type="checkbox"
                  checked={form.ownerAccessAuthorized}
                  onChange={(event) => setForm((current) => ({ ...current, ownerAccessAuthorized: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold leading-5 text-red-900">{t("partners.authorizeOwnerAccess")}</span>
              </label>
            </section>
          )}

          <textarea placeholder={t("partners.note")} value={form.note} rows={3}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </>}
        </div>
      </SlidePanel>
    </div>
  );
}
