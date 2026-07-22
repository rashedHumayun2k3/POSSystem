"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSetSalesChannels } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import ShopTypeSelector from "@/components/ShopTypeSelector";
import { SHOP_TYPES, type ShopType } from "@/lib/shopTypes";

export default function SalesChannelOnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const businesses = useAuthStore((s) => s.businesses);
  const setSalesChannels = useSetSalesChannels();
  const [selected, setSelected] = useState<ShopType | null>(null);

  const alreadyOnboarded = businesses[0]?.onboardingCompleted === true;

  useEffect(() => {
    if (alreadyOnboarded) router.replace("/dashboard");
  }, [alreadyOnboarded, router]);

  if (alreadyOnboarded) return null;

  function handleContinue() {
    if (!selected) return;
    const channels = SHOP_TYPES.find((o) => o.value === selected)!.channels;
    setSalesChannels.mutate(
      { salesChannels: channels },
      {
        onSuccess: () => router.replace("/onboarding/business-type"),
        onError: (err) => toastError(err, t("onboarding.setSalesChannelsFailed")),
      }
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <p className="text-lg font-semibold text-gray-900">{t("onboarding.shopTypeTitle")}</p>
        <p className="text-sm text-gray-500 mt-1">{t("onboarding.shopTypeSubtitle")}</p>
      </div>

      <ShopTypeSelector selected={selected} onSelect={setSelected} disabled={setSalesChannels.isPending} />

      <button
        onClick={handleContinue}
        disabled={!selected || setSalesChannels.isPending}
        className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
      >
        {setSalesChannels.isPending ? t("onboarding.settingUp") : t("onboarding.continue")}
      </button>
    </div>
  );
}
