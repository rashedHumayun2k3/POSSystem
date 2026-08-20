"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSetSalesChannels } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import { useToastStore } from "@/store/toastStore";
import ShopTypeSelector from "@/components/ShopTypeSelector";
import { SHOP_TYPES, shopTypeFromChannels, type ShopType } from "@/lib/shopTypes";

export default function ShopTypeSettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const businesses = useAuthStore((s) => s.businesses);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);
  const updateCurrentBusinessSalesChannels = useAuthStore((s) => s.updateCurrentBusinessSalesChannels);
  const currentBusiness = businesses.find((b) => b.id === currentBusinessId);

  const [draft, setDraft] = useState<{ businessId: string; value: ShopType } | null>(null);
  const savedSelection = currentBusiness?.shopType ?? shopTypeFromChannels(currentBusiness?.salesChannels);
  const selected = draft?.businessId === currentBusinessId ? draft.value : savedSelection;
  const setSalesChannels = useSetSalesChannels();

  function handleSave() {
    if (!selected) return;
    const channels = SHOP_TYPES.find((o) => o.value === selected)!.channels;
    setSalesChannels.mutate(
      { salesChannels: channels, shopType: selected },
      {
        onSuccess: () => {
          updateCurrentBusinessSalesChannels(channels, selected);
          setDraft(null);
          useToastStore.getState().show(t("settings.shopTypeSaved"));
        },
        onError: (err) => toastError(err, t("onboarding.setSalesChannelsFailed")),
      }
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("settings.shopType")}</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <p className="text-sm text-gray-500">{t("onboarding.shopTypeSubtitle")}</p>

        <ShopTypeSelector
          selected={selected}
          onSelect={(value) => currentBusinessId && setDraft({ businessId: currentBusinessId, value })}
          disabled={setSalesChannels.isPending}
        />

        <button
          onClick={handleSave}
          disabled={!selected || setSalesChannels.isPending}
          className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
        >
          {setSalesChannels.isPending ? t("onboarding.settingUp") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
