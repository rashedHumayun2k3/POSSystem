"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCouriers, updateCourier, toggleCourierActive } from "@/lib/settingsApi";
import type { CourierPayload } from "@/lib/settingsApi";
import type { Courier } from "@/types/settings";
import { useLanguage } from "@/i18n/LanguageContext";
import { PencilIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import SlidePanel from "@/components/ui/SlidePanel";
import { useToastStore } from "@/store/toastStore";

const EMPTY_FORM = {
  phone: "",
  insideDhakaCharge: "",
  outsideDhakaCharge: "",
  returnCharge: "",
  codFeeType: "PCT" as "FLAT" | "PCT",
  codFeeValue: "",
  isDefault: false,
  trackingUrlTemplate: "",
};

// Reused as-is on both the dedicated /more/settings/couriers page and inside a SlidePanel popup
// on the order-creation screen — self-contained (owns its own queries/mutations), no header/title
// of its own so each caller can frame it however fits that context.
//
// No "add courier" here by design — every business is auto-provisioned with the platform's full
// courier catalog at signup (and backfilled when PlatformAdmin adds a new one), so a business's
// only levers are Activate/Deactivate and its own rates. Courier identity/existence is
// PlatformAdmin-only (see /platform-admin/couriers).
export default function CourierManager() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [editTarget, setEditTarget] = useState<Courier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: couriers = [], isLoading } = useQuery({
    queryKey: ["couriers"],
    queryFn: getCouriers,
  });

  const openEdit = (c: Courier) => {
    setForm({
      phone: c.phone ?? "",
      insideDhakaCharge: String(c.insideDhakaCharge),
      outsideDhakaCharge: String(c.outsideDhakaCharge),
      returnCharge: String(c.returnCharge),
      codFeeType: c.codFeeType,
      codFeeValue: String(c.codFeeValue),
      isDefault: c.isDefault,
      trackingUrlTemplate: c.trackingUrlTemplate ?? "",
    });
    setEditTarget(c);
  };
  const closeEdit = () => setEditTarget(null);

  const buildPayload = (name: string): CourierPayload => ({
    name,
    phone: form.phone.trim() || undefined,
    insideDhakaCharge: parseFloat(form.insideDhakaCharge) || 0,
    outsideDhakaCharge: parseFloat(form.outsideDhakaCharge) || 0,
    returnCharge: parseFloat(form.returnCharge) || 0,
    codFeeType: form.codFeeType,
    codFeeValue: parseFloat(form.codFeeValue) || 0,
    isDefault: form.isDefault,
    trackingUrlTemplate: form.trackingUrlTemplate.trim() || undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editTarget) return;
      await updateCourier(editTarget.id, buildPayload(editTarget.name));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["couriers"] }); closeEdit(); },
    onError: () => useToastStore.getState().show(t("settings.failedSaveCourier"), "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleCourierActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["couriers"] }),
  });

  return (
    <div className="space-y-2">
      {isLoading ? (
        [1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
      ) : couriers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{t("settings.noCouriers")}</p>
      ) : (
        couriers.map((c) => (
          <div key={c.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                {c.isDefault && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 flex items-center gap-1">
                    <StarSolid className="w-2.5 h-2.5" />{t("settings.defaultBadge")}
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {c.isActive ? t("settings.active") : t("settings.inactive")}
                </span>
              </div>
              {c.phone && <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                <span className="text-xs text-gray-500">ঢাকা ৳{c.insideDhakaCharge}</span>
                <span className="text-xs text-gray-500">বাইরে ৳{c.outsideDhakaCharge}</span>
                <span className="text-xs text-gray-500">{t("settings.returnLabel")} ৳{c.returnCharge}</span>
                <span className="text-xs text-gray-500">
                  COD {c.codFeeType === "PCT" ? `${c.codFeeValue}%` : `৳${c.codFeeValue}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button onClick={() => toggleMutation.mutate(c.id)}
                className={`text-xs font-medium px-2 py-1 rounded-lg ${c.isActive ? "bg-gray-100 text-gray-600" : "bg-green-50 text-green-700"}`}>
                {c.isActive ? t("settings.deactivate") : t("settings.activate")}
              </button>
            </div>
          </div>
        ))
      )}

      {/* Edit — rates/phone/default are still the business's own to set; only the catalog entry
          this was created from (name/existence) is platform-managed. */}
      <SlidePanel
        open={!!editTarget}
        onClose={closeEdit}
        title={editTarget?.name ?? ""}
        footer={
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
          >
            {saveMutation.isPending ? t("common.saving") : t("common.save")}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("settings.courierPhone")}</label>
            <input value={form.phone} type="tel"
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">{t("settings.insideDhakaCharge")}</label>
              <input value={form.insideDhakaCharge}
                type="number" inputMode="decimal" min="0"
                onChange={(e) => setForm((f) => ({ ...f, insideDhakaCharge: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">{t("settings.outsideDhakaCharge")}</label>
              <input value={form.outsideDhakaCharge}
                type="number" inputMode="decimal" min="0"
                onChange={(e) => setForm((f) => ({ ...f, outsideDhakaCharge: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("settings.returnCharge")}</label>
            <input value={form.returnCharge}
              type="number" inputMode="decimal" min="0"
              onChange={(e) => setForm((f) => ({ ...f, returnCharge: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t("settings.codFeeLabel")}</p>
            <div className="flex gap-2">
              <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
                {(["PCT", "FLAT"] as const).map((type) => (
                  <button key={type} type="button"
                    onClick={() => setForm((f) => ({ ...f, codFeeType: type }))}
                    className={`px-3 h-11 text-sm font-medium transition-colors ${form.codFeeType === type ? "bg-indigo-600 text-white" : "bg-white text-gray-500"}`}>
                    {type === "PCT" ? "%" : "৳"}
                  </button>
                ))}
              </div>
              <input
                placeholder={form.codFeeType === "PCT" ? t("settings.codFeeValuePct") : t("settings.codFeeValueFlat")}
                value={form.codFeeValue} type="number" inputMode="decimal" min="0"
                onChange={(e) => setForm((f) => ({ ...f, codFeeValue: e.target.value }))}
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("settings.trackingUrlTemplate")}</label>
            <input value={form.trackingUrlTemplate}
              onChange={(e) => setForm((f) => ({ ...f, trackingUrlTemplate: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <button type="button"
            onClick={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
            className={`w-full h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${form.isDefault ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"}`}>
            {form.isDefault ? <StarSolid className="w-4 h-4" /> : <StarIcon className="w-4 h-4" />}
            {t("settings.setDefaultCourier")}
          </button>
        </div>
      </SlidePanel>
    </div>
  );
}
