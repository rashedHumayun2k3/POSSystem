"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { SHOP_TYPES, type ShopType } from "@/lib/shopTypes";

export default function ShopTypeSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: ShopType | null;
  onSelect: (value: ShopType) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {SHOP_TYPES.map(({ value, icon }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(value)}
              className={`relative flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all disabled:opacity-60 ${
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
              <span>
                <span className="block text-sm font-semibold text-gray-900 leading-tight">
                  {t(`onboarding.shopType.${value}`)}
                </span>
                <span className="block text-xs text-gray-500 mt-1 leading-snug">
                  {t(`onboarding.shopType.${value}Desc`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 px-1">{t("onboarding.shopType.onlineNote")}</p>
    </div>
  );
}
