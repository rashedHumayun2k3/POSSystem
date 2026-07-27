"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAppSettings, upsertSetting } from "@/lib/settingsApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

export default function BusinessConfigPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [targetMargin, setTargetMargin] = useState("");
  const [overheadMode, setOverheadMode] = useState("AUTO");
  const [refundThreshold, setRefundThreshold] = useState("");
  const [lowStockDefault, setLowStockDefault] = useState("");
  const [returnPolicyDays, setReturnPolicyDays] = useState("");
  const [sellingMode, setSellingMode] = useState("BOTH");
  const [savedKey, setSavedKey] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: getAppSettings,
  });

  useEffect(() => {
    if (!settings) return;
    if (settings.target_margin_pct) setTargetMargin(settings.target_margin_pct);
    if (settings.overhead_mode) setOverheadMode(settings.overhead_mode);
    if (settings.refund_threshold) setRefundThreshold(settings.refund_threshold);
    if (settings.low_stock_default) setLowStockDefault(settings.low_stock_default);
    if (settings.return_policy_days) setReturnPolicyDays(settings.return_policy_days);
    if (settings.selling_mode) setSellingMode(settings.selling_mode);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => upsertSetting(key, value),
    onSuccess: (_, { key }) => {
      setSavedKey(key);
      setTimeout(() => setSavedKey(""), 2000);
    },
  });

  const save = (key: string, value: string) => saveMutation.mutate({ key, value });

  const ConfigRow = ({
    label, hint, children, settingKey, value,
  }: {
    label: string; hint?: string; children: React.ReactNode; settingKey: string; value: string;
  }) => (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {savedKey === settingKey && (
          <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
        )}
      </div>
      {children}
      <button
        onClick={() => save(settingKey, value)}
        disabled={saveMutation.isPending}
        className="w-full h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
      >
        {saveMutation.isPending && saveMutation.variables?.key === settingKey
          ? t("common.saving")
          : t("common.save")}
      </button>
    </div>
  );

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("settings.configTitle")}</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <ConfigRow label={t("settings.targetMargin")} hint={t("settings.targetMarginHint")} settingKey="target_margin_pct" value={targetMargin}>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" value={targetMargin}
              onChange={(e) => setTargetMargin(e.target.value)}
              placeholder="e.g. 20"
              className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-sm text-gray-500 font-medium">%</span>
          </div>
        </ConfigRow>

        <ConfigRow label={t("settings.overheadMode")} settingKey="overhead_mode" value={overheadMode}>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(["AUTO", "MANUAL"] as const).map((m) => (
              <button key={m} onClick={() => setOverheadMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition ${overheadMode === m ? "bg-indigo-600 text-white" : "text-gray-600"}`}>
                {m === "AUTO" ? t("settings.overheadAuto") : t("settings.overheadManual")}
              </button>
            ))}
          </div>
        </ConfigRow>

        <ConfigRow label={t("settings.refundThreshold")} hint={t("settings.refundThresholdHint")} settingKey="refund_threshold" value={refundThreshold}>
          <input type="number" inputMode="decimal" value={refundThreshold}
            onChange={(e) => setRefundThreshold(e.target.value)}
            placeholder="e.g. 500"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </ConfigRow>

        <ConfigRow label={t("settings.lowStockDefault")} hint={t("settings.lowStockHint")} settingKey="low_stock_default" value={lowStockDefault}>
          <input type="number" inputMode="decimal" value={lowStockDefault}
            onChange={(e) => setLowStockDefault(e.target.value)}
            placeholder="e.g. 5"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </ConfigRow>

        <ConfigRow label={t("settings.returnPolicyDays")} settingKey="return_policy_days" value={returnPolicyDays}>
          <input type="number" inputMode="numeric" value={returnPolicyDays}
            onChange={(e) => setReturnPolicyDays(e.target.value)}
            placeholder="e.g. 7"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </ConfigRow>

        <ConfigRow label={t("settings.sellingMode")} hint={t("settings.sellingModeHint")} settingKey="selling_mode" value={sellingMode}>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(["RETAIL", "WHOLESALE", "BOTH"] as const).map((m) => (
              <button key={m} onClick={() => setSellingMode(m)}
                className={`flex-1 py-2.5 text-xs font-medium transition ${sellingMode === m ? "bg-indigo-600 text-white" : "text-gray-600"}`}>
                {m === "RETAIL" ? t("settings.sellingModeRetail") : m === "WHOLESALE" ? t("settings.sellingModeWholesale") : t("settings.sellingModeBoth")}
              </button>
            ))}
          </div>
        </ConfigRow>
      </div>
    </div>
  );
}
