"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  listSuggestedCategories,
  addSuggestedCategories,
  listCategoriesWithSuggestions,
} from "@/lib/catalogTemplatesApi";
import ProductSuggestionsPicker from "@/components/catalog/ProductSuggestionsPicker";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCategoryEmoji, getBusinessTypeEmoji } from "@/lib/categoryEmoji";
import { suggestedCategoryDisplayName } from "@/lib/suggestedCategoryBn";
import { useToastStore } from "@/store/toastStore";

export default function CatalogTemplatesPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const [addingId, setAddingId] = useState<string | null>(null);

  const { data: suggestedCategories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["catalog-templates-suggested-categories"],
    queryFn: listSuggestedCategories,
  });

  const { data: categoriesWithSuggestions = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["catalog-templates-categories"],
    queryFn: listCategoriesWithSuggestions,
  });

  const addOneMutation = useMutation({
    mutationFn: (id: string) => addSuggestedCategories([id]),
    onSuccess: () => {
      setAddingId(null);
      qc.invalidateQueries({ queryKey: ["catalog-templates-suggested-categories"] });
      qc.invalidateQueries({ queryKey: ["catalog-templates-categories"] });
      useToastStore.getState().show(t("catalogTemplates.categoryAdded"));
    },
    onError: () => setAddingId(null),
  });

  const handleAdd = (id: string) => {
    setAddingId(id);
    addOneMutation.mutate(id);
  };

  const notYetAdded = suggestedCategories.filter((c) => !c.alreadyAdded);
  const groupedByType = notYetAdded.reduce<Record<string, typeof notYetAdded>>((acc, c) => {
    (acc[c.businessTypeCode] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("catalogTemplates.title")}</h1>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Section B: add products to existing categories */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t("catalogTemplates.addProductsTitle")}
          </p>
          {loadingProducts ? (
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ) : categoriesWithSuggestions.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{t("catalogTemplates.noCategoriesYet")}</p>
          ) : (
            <>
              <p className="flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 mb-3">
                <span>💡</span>
                <span>{t("catalogTemplates.addProductsTip")}</span>
              </p>
              <ProductSuggestionsPicker categories={categoriesWithSuggestions} />
            </>
          )}
        </div>

        {/* Section A: add more categories */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t("catalogTemplates.addCategoriesTitle")}
          </p>
          {loadingCategories ? (
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ) : notYetAdded.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{t("catalogTemplates.allCategoriesAdded")}</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByType).map(([typeCode, cats]) => (
                <div key={typeCode}>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    {getBusinessTypeEmoji(typeCode)} {t(`onboarding.type.${typeCode}`)}
                  </p>
                  <div className="space-y-2">
                    {cats.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-100 bg-white"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {getCategoryEmoji(cat.name, cat.businessTypeCode)} {suggestedCategoryDisplayName(cat.name, lang)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdd(cat.id)}
                          disabled={addingId === cat.id}
                          className="shrink-0 text-xs font-semibold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg disabled:opacity-40"
                        >
                          {addingId === cat.id ? t("common.adding") : t("catalogTemplates.addToMyBusiness")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
