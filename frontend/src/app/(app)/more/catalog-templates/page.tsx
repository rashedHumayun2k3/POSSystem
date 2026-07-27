"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  listSuggestedCategories,
  addSuggestedCategories,
  listCategoriesWithSuggestions,
} from "@/lib/catalogTemplatesApi";
import { deleteCategory } from "@/lib/catalogApi";
import ProductSuggestionsPicker from "@/components/catalog/ProductSuggestionsPicker";
import AddedProductsList from "@/components/catalog/AddedProductsList";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCategoryEmoji, getBusinessTypeEmoji } from "@/lib/categoryEmoji";
import { suggestedCategoryDisplayName } from "@/lib/suggestedCategoryBn";
import { useToastStore } from "@/store/toastStore";
import { toastError } from "@/lib/toastError";
import { useAuthStore } from "@/store/authStore";

type TabKey = "categories" | "myAddedProducts";

export default function CatalogTemplatesPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const owner = useAuthStore((s) => s.isOwner());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("categories");
  const tabsScrollRef = useRef<HTMLDivElement>(null);

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

  const removeMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(categoryId),
    onSuccess: () => {
      setRemovingId(null);
      qc.invalidateQueries({ queryKey: ["catalog-templates-suggested-categories"] });
      qc.invalidateQueries({ queryKey: ["catalog-templates-categories"] });
      useToastStore.getState().show(t("catalogTemplates.categoryRemoved"));
    },
    onError: (err: unknown) => {
      setRemovingId(null);
      // The backend's own message is always English ("Cannot delete a category that has
      // products."), so translate that one known case here rather than showing it raw in bn.
      const backendMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (backendMessage === "Cannot delete a category that has products.") {
        useToastStore.getState().show(t("catalogTemplates.categoryHasProducts"), "error");
      } else {
        toastError(err, t("catalogTemplates.removeCategoryFailed"));
      }
    },
  });

  // Backend enforces the actual rule (blocks deletion if the category already has products) —
  // this confirm is just a speed bump against accidental taps, not the safety check itself.
  const handleRemove = (categoryId: string) => {
    if (!window.confirm(t("catalogTemplates.removeCategoryConfirm"))) return;
    setRemovingId(categoryId);
    removeMutation.mutate(categoryId);
  };

  // Grouped by business type so an already-added category (e.g. Wallet) stays in its own
  // section (e.g. 👜 Bags & Accessories) alongside the not-yet-added ones of that same type,
  // instead of being pulled out into a separate flat block.
  const groupedByType = suggestedCategories.reduce<Record<string, typeof suggestedCategories>>((acc, c) => {
    (acc[c.businessTypeCode] ??= []).push(c);
    return acc;
  }, {});

  const TABS: { key: TabKey; label: string }[] = [
    { key: "categories", label: t("catalogTemplates.tabMySelectedCategories") },
    { key: "myAddedProducts", label: t("catalogTemplates.tabMyAddedProducts") },
  ];

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-900">{t("catalogTemplates.title")}</h1>
        </div>

        {/* Tabs — horizontally scrollable; the right-edge fade + arrow signal "more tabs this
            way" (arrow also actually scrolls on tap, not just decorative). */}
        <div className="relative mt-3">
          <div ref={tabsScrollRef} className="flex gap-0 border-b border-gray-100 -mb-px overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent" />
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: 120, behavior: "smooth" })}
            className="absolute top-0 right-0 bottom-px flex items-center px-1 text-indigo-500"
            aria-label={t("common.scrollRight")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {activeTab === "categories" && (
          <div>
            {!loadingProducts && categoriesWithSuggestions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {t("catalogTemplates.selectedCategoriesForBusiness")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoriesWithSuggestions.map((cat) => (
                    <span
                      key={cat.categoryId}
                      className="flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-full pl-3 pr-1.5 py-1.5"
                    >
                      {getCategoryEmoji(cat.name)} {suggestedCategoryDisplayName(cat.name, lang)}
                      {owner && (
                        <button
                          type="button"
                          onClick={() => handleRemove(cat.categoryId)}
                          disabled={removingId === cat.categoryId}
                          aria-label={t("common.remove")}
                          className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-green-600 hover:bg-green-100 disabled:opacity-40"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {t("catalogTemplates.categoriesTitle")}
            </p>

            {loadingProducts || loadingCategories ? (
              <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ) : suggestedCategories.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{t("catalogTemplates.noCategoriesYet")}</p>
            ) : (
              <div className="space-y-4">
                {categoriesWithSuggestions.length > 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                    <span>💡</span>
                    <span>{t("catalogTemplates.addProductsTip")}</span>
                  </p>
                )}

                {Object.entries(groupedByType).map(([typeCode, cats]) => {
                  // Already-added categories of this type, resolved to their real Category
                  // (with its live suggestion count) so they render as green pills here,
                  // in the same section as the not-yet-added ones of the same business type.
                  const addedInGroup = cats
                    .filter((c) => c.alreadyAdded)
                    .map((c) => categoriesWithSuggestions.find((cws) => cws.suggestedCategoryId === c.id))
                    .filter((c): c is NonNullable<typeof c> => !!c);
                  const notAddedInGroup = cats.filter((c) => !c.alreadyAdded);

                  return (
                    <div key={typeCode}>
                      <p className="text-[11px] text-gray-400 mb-1.5">
                        {getBusinessTypeEmoji(typeCode)} {t(`onboarding.type.${typeCode}`)}
                      </p>
                      <div className="space-y-2">
                        {addedInGroup.length > 0 && <ProductSuggestionsPicker categories={addedInGroup} />}
                        {notAddedInGroup.map((cat) => (
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "myAddedProducts" && <AddedProductsList />}
      </div>
    </div>
  );
}
