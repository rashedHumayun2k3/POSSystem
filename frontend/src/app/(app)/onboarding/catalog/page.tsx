"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { listCategoriesWithSuggestions } from "@/lib/catalogTemplatesApi";
import ProductSuggestionsPicker from "@/components/catalog/ProductSuggestionsPicker";
import { useLanguage } from "@/i18n/LanguageContext";

export default function OnboardingCatalogPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const { data: categoriesWithSuggestions = [], isLoading } = useQuery({
    queryKey: ["catalog-templates-categories"],
    queryFn: listCategoriesWithSuggestions,
  });

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold text-gray-900">{t("catalogTemplates.onboardingTitle")}</p>
          <p className="text-sm text-gray-500 mt-1">{t("catalogTemplates.onboardingSubtitle")}</p>
        </div>
        <button
          onClick={() => router.replace("/dashboard")}
          className="text-xs font-semibold text-gray-400 shrink-0 mt-1"
        >
          {t("catalogTemplates.skipForNow")}
        </button>
      </div>

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      ) : categoriesWithSuggestions.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">{t("catalogTemplates.noCategoriesYet")}</p>
      ) : (
        <ProductSuggestionsPicker categories={categoriesWithSuggestions} />
      )}

      <button
        onClick={() => router.replace("/dashboard")}
        className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base"
      >
        {t("catalogTemplates.doneGoToDashboard")}
      </button>
    </div>
  );
}
