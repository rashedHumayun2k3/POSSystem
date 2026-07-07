"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSetSalesChannels } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import type { SalesChannel } from "@/types/auth";

const SALES_CHANNELS: { value: SalesChannel; icon: string }[] = [
  { value: "POS", icon: "🏬" },
  { value: "HAWKER", icon: "🧺" },
  { value: "ONLINE", icon: "📦" },
];

function errMsg(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function SalesChannelOnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const businesses = useAuthStore((s) => s.businesses);
  const setSalesChannels = useSetSalesChannels();
  const [selected, setSelected] = useState<SalesChannel[]>([]);

  const alreadyOnboarded = businesses[0]?.onboardingCompleted === true;

  useEffect(() => {
    if (alreadyOnboarded) router.replace("/dashboard");
  }, [alreadyOnboarded, router]);

  if (alreadyOnboarded) return null;

  function toggle(value: SalesChannel) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function handleContinue() {
    if (selected.length === 0) return;
    setSalesChannels.mutate({ salesChannels: selected });
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <p className="text-lg font-semibold text-gray-900">{t("onboarding.salesChannelTitle")}</p>
        <p className="text-sm text-gray-500 mt-1">{t("onboarding.salesChannelSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {SALES_CHANNELS.map(({ value, icon }) => {
          const isSelected = selected.includes(value);
          return (
            <button
              key={value}
              disabled={setSalesChannels.isPending}
              onClick={() => toggle(value)}
              className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all disabled:opacity-60 ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-100 bg-gray-50 hover:border-indigo-200"
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                  ✓
                </span>
              )}
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-semibold text-gray-900 leading-tight">
                {t(`onboarding.channel.${value}`)}
              </span>
            </button>
          );
        })}
      </div>

      {setSalesChannels.isError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {errMsg(setSalesChannels.error, t("onboarding.setSalesChannelsFailed"))}
        </p>
      )}

      <button
        onClick={handleContinue}
        disabled={selected.length === 0 || setSalesChannels.isPending}
        className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
      >
        {setSalesChannels.isPending ? t("onboarding.settingUp") : t("onboarding.continue")}
      </button>
    </div>
  );
}
