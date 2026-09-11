"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSetBusinessTypes } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import type { BusinessType } from "@/types/auth";

const BUSINESS_TYPES: { value: BusinessType; icon: string }[] = [
  { value: "CLOTHING_FASHION", icon: "👕" },
  { value: "COSMETICS_BEAUTY", icon: "💄" },
  { value: "ELECTRONICS_GADGETS", icon: "📱" },
  { value: "SHOES_FOOTWEAR", icon: "👟" },
  { value: "BAGS_ACCESSORIES", icon: "👜" },
  { value: "TOYS_BABY", icon: "🧸" },
  { value: "HOME_KITCHEN", icon: "🍽️" },
  { value: "BOOKS_STATIONERY", icon: "📚" },
  { value: "OTHER", icon: "🗂️" },
];

export default function BusinessTypeOnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const businesses = useAuthStore((s) => s.businesses);
  const setBusinessTypes = useSetBusinessTypes();
  const [selected, setSelected] = useState<BusinessType[]>([]);

  const alreadyOnboarded = businesses[0]?.onboardingCompleted === true;

  useEffect(() => {
    if (alreadyOnboarded) router.replace("/dashboard");
  }, [alreadyOnboarded, router]);

  if (alreadyOnboarded) return null;

  function toggle(value: BusinessType) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function handleContinue() {
    if (selected.length === 0) return;
    setBusinessTypes.mutate(
      { businessTypes: selected },
      { onError: (err) => toastError(err, t("onboarding.setBusinessTypeFailed")) }
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <p className="text-lg font-semibold text-gray-900">{t("onboarding.businessTypeTitle")}</p>
        <p className="text-sm text-gray-500 mt-1">{t("onboarding.businessTypeSubtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BUSINESS_TYPES.map(({ value, icon }) => {
          const isSelected = selected.includes(value);
          return (
            <button
              key={value}
              disabled={setBusinessTypes.isPending}
              onClick={() => toggle(value)}
              className={`relative flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition-all disabled:opacity-60 ${
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
                {t(`onboarding.type.${value}`)}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={selected.length === 0 || setBusinessTypes.isPending}
        className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
      >
        {setBusinessTypes.isPending ? t("onboarding.settingUp") : t("onboarding.continue")}
      </button>
    </div>
  );
}
