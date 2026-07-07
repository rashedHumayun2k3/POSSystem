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

export default function CatalogTemplatesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  const { data: suggestedCategories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["catalog-templates-suggested-categories"],
    queryFn: listSuggestedCategories,
  });

  const { data: categoriesWithSuggestions = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["catalog-templates-categories"],
    queryFn: listCategoriesWithSuggestions,
  });

  const addCategoriesMutation = useMutation({
    mutationFn: () => addSuggestedCategories([...selectedCategoryIds]),
    onSuccess: () => {
      setSelectedCategoryIds(new Set());
      qc.invalidateQueries({ queryKey: ["catalog-templates-suggested-categories"] });
      qc.invalidateQueries({ queryKey: ["catalog-templates-categories"] });
    },
  });

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <div className="space-y-3">
              {Object.entries(groupedByType).map(([typeCode, cats]) => (
                <div key={typeCode}>
                  <p className="text-[11px] text-gray-400 mb-1">{typeCode.replaceAll("_", " ")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {cats.map((cat) => {
                      const isSelected = selectedCategoryIds.has(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-gray-100 bg-white text-gray-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategory(cat.id)}
                            className="w-4 h-4 rounded accent-indigo-600"
                          />
                          <span className="flex-1">{cat.name}</span>
                          {isSelected && (
                            <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={() => addCategoriesMutation.mutate()}
                disabled={selectedCategoryIds.size === 0 || addCategoriesMutation.isPending}
                className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
              >
                {addCategoriesMutation.isPending
                  ? t("common.saving")
                  : t("catalogTemplates.addSelectedCategories", { count: selectedCategoryIds.size })}
              </button>
            </div>
          )}
        </div>

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
            <ProductSuggestionsPicker categories={categoriesWithSuggestions} />
          )}
        </div>
      </div>
    </div>
  );
}
