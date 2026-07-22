"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getStaff, createStaff, updateStaff, deactivateStaff, resetStaffPassword } from "@/lib/settingsApi";
import type { StaffUser } from "@/types/settings";
import { useLanguage } from "@/i18n/LanguageContext";
import { PencilIcon } from "@heroicons/react/24/outline";
import SlidePanel from "@/components/ui/SlidePanel";
import { toastError } from "@/lib/toastError";

type PanelMode = "view" | "add" | "edit" | null;

const ROLES = ["OWNER", "MANAGER", "STAFF", "WAREHOUSE"] as const;
const EMPTY_FORM = { name: "", phone: "", password: "", role: "STAFF", monthlySalary: "" };

export default function StaffPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [mode, setMode] = useState<PanelMode>(null);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
  });

  const openView = (u: StaffUser) => { setSelected(u); setShowResetPw(false); setNewPassword(""); setMode("view"); };
  const openAdd  = () => { setForm(EMPTY_FORM); setSelected(null); setMode("add"); };
  const openEdit = (u: StaffUser) => {
    setForm({ name: u.name, phone: u.phone, password: "", role: u.role, monthlySalary: String(u.monthlySalary) });
    setSelected(u); setMode("edit");
  };
  const close = () => { setMode(null); setSelected(null); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === "add") {
        await createStaff({
          name: form.name, phone: form.phone, password: form.password,
          role: form.role, monthlySalary: parseFloat(form.monthlySalary) || 0,
        });
      } else if (selected) {
        await updateStaff(selected.id, {
          name: form.name, role: form.role,
          monthlySalary: parseFloat(form.monthlySalary) || 0,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); close(); },
    onError: (err: unknown) => toastError(err, t("settings.failedSaveStaff")),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateStaff(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); close(); },
  });

  const resetPwMutation = useMutation({
    mutationFn: () => resetStaffPassword(selected!.id, newPassword),
    onSuccess: () => { setShowResetPw(false); setNewPassword(""); },
    onError: (err: unknown) => toastError(err, t("settings.failedResetPassword")),
  });

  const panelTitle =
    mode === "add"  ? t("settings.addStaff") :
    mode === "edit" ? t("settings.edit") :
    selected?.name ?? "";

  const panelFooter = mode === "view" && selected ? (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => openEdit(selected)}
        className="w-full h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
      >
        <PencilIcon className="w-4 h-4" />
        {t("settings.edit")}
      </button>
      {selected.isActive && selected.role !== "OWNER" && (
        <button
          onClick={() => { if (confirm(t("settings.deactivate") + "?")) deactivateMutation.mutate(selected.id); }}
          disabled={deactivateMutation.isPending}
          className="w-full h-11 rounded-xl border border-red-200 text-red-500 text-sm font-semibold disabled:opacity-40"
        >
          {t("settings.deactivate")}
        </button>
      )}
    </div>
  ) : (mode === "add" || mode === "edit") ? (
    <>
      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !form.name}
        className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
      >
        {saveMutation.isPending ? t("common.saving") : t("common.save")}
      </button>
    </>
  ) : null;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t("settings.staffTitle")}</h1>
        <button onClick={openAdd} className="text-sm font-semibold text-indigo-600">{t("settings.addStaff")}</button>
      </div>

      {/* Staff list */}
      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t("settings.noStaff")}</p>
        ) : (
          staff.map((u) => (
            <button
              key={u.id}
              onClick={() => openView(u)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 active:bg-gray-50 transition text-left"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-indigo-600">{u.name[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.isActive ? t("settings.active") : t("settings.inactive")}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{u.phone} · {t(`settings.role${u.role.charAt(0) + u.role.slice(1).toLowerCase()}`)}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))
        )}
      </div>

      {/* ── SlidePanel ────────────────────────────────────────────────── */}
      <SlidePanel
        open={mode !== null}
        onClose={close}
        title={panelTitle}
        footer={panelFooter}
      >
        {/* ── View mode ── */}
        {mode === "view" && selected && (
          <div className="px-4 py-4 space-y-3">
            <div className="flex justify-center py-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-indigo-600">{selected.name[0].toUpperCase()}</span>
              </div>
            </div>

            <Row label={t("settings.namePlaceholder")} value={selected.name} />
            <Row label={t("settings.phonePlaceholder")} value={selected.phone} />
            <Row label={t("settings.roleLabel")} value={t(`settings.role${selected.role.charAt(0) + selected.role.slice(1).toLowerCase()}`)} />
            <Row label={t("settings.salaryPlaceholder")} value={`৳${selected.monthlySalary.toLocaleString()}`} />
            <Row
              label={t("settings.statusLabel")}
              value={selected.isActive ? t("settings.active") : t("settings.inactive")}
              valueClass={selected.isActive ? "text-green-600 font-medium" : "text-gray-400"}
            />

            {/* Reset password section */}
            <div className="pt-2">
              {!showResetPw ? (
                <button
                  onClick={() => setShowResetPw(true)}
                  className="text-xs text-indigo-600 font-medium py-1"
                >
                  {t("settings.resetPassword")}
                </button>
              ) : (
                <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-700">{t("settings.resetPassword")}</p>
                  <input
                    type="password"
                    placeholder={t("settings.newPasswordPlaceholder")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resetPwMutation.mutate()}
                      disabled={newPassword.length < 6 || resetPwMutation.isPending}
                      className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40"
                    >
                      {resetPwMutation.isPending ? t("common.saving") : t("settings.setPassword")}
                    </button>
                    <button
                      onClick={() => { setShowResetPw(false); setNewPassword(""); }}
                      className="px-3 h-9 rounded-xl border border-gray-200 text-xs text-gray-500"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Add / Edit form ── */}
        {(mode === "add" || mode === "edit") && (
          <div className="px-4 py-4 space-y-3">
            <input
              placeholder={t("settings.namePlaceholder")} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {mode === "add" && (
              <>
                <input
                  placeholder={t("settings.phonePlaceholder")} value={form.phone} type="tel"
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder={t("settings.passwordPlaceholder")} value={form.password} type="password"
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </>
            )}
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {ROLES.map((r) => (
                <button key={r} onClick={() => setForm((f) => ({ ...f, role: r }))}
                  className={`flex-1 py-2.5 text-xs font-medium transition ${form.role === r ? "bg-indigo-600 text-white" : "text-gray-600"}`}>
                  {t(`settings.role${r.charAt(0) + r.slice(1).toLowerCase()}`)}
                </button>
              ))}
            </div>
            <input
              placeholder={t("settings.salaryPlaceholder")} value={form.monthlySalary}
              type="number" inputMode="decimal"
              onChange={(e) => setForm((f) => ({ ...f, monthlySalary: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </SlidePanel>
    </div>
  );
}

function Row({ label, value, valueClass = "text-gray-900" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}
