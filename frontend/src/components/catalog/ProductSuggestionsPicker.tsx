"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SlidePanel from "@/components/ui/SlidePanel";
import CustomSelect from "@/components/ui/CustomSelect";
import { listSuggestedProducts, addSuggestedProducts } from "@/lib/catalogTemplatesApi";
import { listBranches } from "@/lib/branchesApi";
import type { CategoryWithSuggestions } from "@/types/catalogTemplates";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCategoryEmoji } from "@/lib/categoryEmoji";
import { suggestedCategoryDisplayName } from "@/lib/suggestedCategoryBn";
import { toastError } from "@/lib/toastError";
import { resolveMediaUrl } from "@/lib/media";

interface Props {
  categories: CategoryWithSuggestions[];
}

export default function ProductSuggestionsPicker({ categories }: Props) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<CategoryWithSuggestions | null>(null);
  const [selected, setSelected] = useState<Record<string, {
    suggestedProductId: string | null;
    qty: string;
    unitCost: string;
    price: string;
  }>>({});
  const [customName, setCustomName] = useState("");
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggested-products", activeCategory?.categoryId],
    queryFn: () => listSuggestedProducts(activeCategory!.categoryId),
    enabled: !!activeCategory,
  });

  const openCategory = (category: CategoryWithSuggestions) => {
    setActiveCategory(category);
    setSelected({});
    setCustomName("");
    setCustomNames([]);
    setSearchTerm("");
    const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
    setBranchId(defaultBranch?.id ?? "");
  };

  const toggle = (name: string, suggestedProductId: string | null = null) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = { suggestedProductId, qty: "", unitCost: "", price: "" };
      return next;
    });
  };

  const updateField = (name: string, field: "qty" | "unitCost" | "price", value: string) => {
    setSelected((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  const addCustomName = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setCustomNames((prev) => [...prev, trimmed]);
    setSelected((prev) => ({ ...prev, [trimmed]: { suggestedProductId: null, qty: "", unitCost: "", price: "" } }));
    setCustomName("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(selected).map(([name, v]) => ({
        suggestedProductId: v.suggestedProductId,
        name,
        sellingPrice: v.price ? Number(v.price) : undefined,
        quantity: Number(v.qty),
        unitCost: Number(v.unitCost),
      }));
      return addSuggestedProducts({
        categoryId: activeCategory!.categoryId,
        branchId: branchId || undefined,
        items,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-templates-categories"] });
      setActiveCategory(null);
    },
    onError: (err: unknown) => toastError(err, t("catalogTemplates.saveFailed")),
  });

  const selectedCount = Object.keys(selected).length;
  const needsBranchPick = branches.length > 1 && !branchId;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleSuggestions = suggestions.filter((s) =>
    s.name.toLowerCase().includes(normalizedSearch)
  );
  const visibleCustomNames = customNames.filter((name) =>
    name.toLowerCase().includes(normalizedSearch)
  );
  // Every item needs a real quantity + buy price — same rule as New Product and Add Variant, so
  // a product can never exist here without a cost basis either.
  const missingRequiredFields = Object.values(selected).some(
    (v) => !v.qty.trim() || parseFloat(v.qty) <= 0 || !v.unitCost.trim()
  );
  const canSave = selectedCount > 0 && !needsBranchPick && !missingRequiredFields;

  return (
    <>
      <div className="space-y-2">
        {categories.map((cat) => (
          <button
            key={cat.categoryId}
            onClick={() => openCategory(cat)}
            disabled={cat.availableSuggestionCount === 0}
            className="w-full flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 disabled:opacity-40"
          >
            <span className="text-sm font-medium text-green-900">{getCategoryEmoji(cat.name)} {suggestedCategoryDisplayName(cat.name, lang)}</span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-green-600">
                {cat.availableSuggestionCount > 0
                  ? t("catalogTemplates.suggestionsAvailable", { count: cat.availableSuggestionCount })
                  : t("catalogTemplates.noMoreSuggestions")}
              </span>
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <SlidePanel
        open={!!activeCategory}
        onClose={() => setActiveCategory(null)}
        title={activeCategory?.name ?? ""}
        footer={
          <div className="space-y-2">
            {needsBranchPick && (
              <p className="text-xs text-amber-600">{t("catalogTemplates.pickBranchFirst")}</p>
            )}
            {!needsBranchPick && missingRequiredFields && (
              <p className="text-xs text-amber-600">{t("catalogTemplates.qtyAndBuyPriceRequired")}</p>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!canSave || saveMutation.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {saveMutation.isPending
                ? t("common.saving")
                : t("catalogTemplates.addSelected", { count: selectedCount })}
            </button>
          </div>
        }
      >
        <div className="px-4 py-3 space-y-4">
          <p className="flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
            <span>💡</span>
            <span>{t("catalogTemplates.pickProductsTip")}</span>
          </p>

          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products"
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          />

          {branches.length > 1 && (
            <CustomSelect
              triggerClassName="w-full h-11 flex items-center justify-between gap-2 px-3 rounded-xl border border-gray-200 text-sm bg-white text-left"
              value={branchId}
              onChange={setBranchId}
              placeholder={t("catalogTemplates.selectBranch")}
              options={[
                { value: '', label: t("catalogTemplates.selectBranch") },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          )}

          {/* Suggested products */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {[
                ...visibleSuggestions.map((s) => ({
                  id: s.id,
                  name: s.name,
                  imageUrl: s.imageUrl,
                  alreadyAdded: s.alreadyAdded,
                  existingSellingPrice: s.existingSellingPrice,
                  existingQuantity: s.existingQuantity,
                })),
                ...visibleCustomNames.map((name) => ({ id: null, name, imageUrl: null, alreadyAdded: false, existingSellingPrice: null, existingQuantity: null })),
              ].map(({ id, name, imageUrl, alreadyAdded, existingSellingPrice, existingQuantity }) => {
                const isChecked = !!selected[name];
                if (alreadyAdded) {
                  return (
                    <div
                      key={name}
                      className="flex items-center gap-2.5 border border-gray-100 bg-gray-50 rounded-xl p-2.5"
                    >
                      <input type="checkbox" checked disabled className="w-4 h-4 rounded accent-gray-300" />
                      <ProductSuggestionImage imageUrl={imageUrl} name={name} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-400 line-through block truncate">{name}</span>
                        {(existingQuantity != null || existingSellingPrice != null) && (
                          <span className="text-[11px] text-gray-400">
                            {existingQuantity != null && `${t("catalogTemplates.qty")}: ${existingQuantity}`}
                            {existingQuantity != null && existingSellingPrice != null && " · "}
                            {existingSellingPrice != null && `৳${existingSellingPrice}`}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium shrink-0">
                        {t("catalogTemplates.alreadyAdded")}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={name}
                    className={`border rounded-xl p-2.5 transition-colors ${
                      isChecked ? "border-indigo-500 bg-indigo-50" : "border-gray-100"
                    }`}
                  >
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(name, id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <ProductSuggestionImage imageUrl={imageUrl} name={name} />
                      <span className={`text-sm flex-1 ${isChecked ? "text-indigo-700 font-medium" : "text-gray-900"}`}>
                        {name}
                      </span>
                      {isChecked && (
                        <span className="text-indigo-600 shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </label>
                    {/* Qty + Buy Price are always required — every product added here gets a real
                        cost basis, same rule as New Product and Add Variant. Selling Price stays
                        optional. */}
                    {isChecked && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          placeholder={t("catalogTemplates.qty")}
                          value={selected[name].qty}
                          onChange={(e) => updateField(name, "qty", e.target.value)}
                          className="h-9 px-2 rounded-lg border border-gray-200 text-xs"
                          required
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder={t("catalogTemplates.unitCost")}
                          value={selected[name].unitCost}
                          onChange={(e) => updateField(name, "unitCost", e.target.value)}
                          className="h-9 px-2 rounded-lg border border-gray-200 text-xs"
                          required
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder={t("catalogTemplates.sellingPriceOptional")}
                          value={selected[name].price}
                          onChange={(e) => updateField(name, "price", e.target.value)}
                          className="h-9 px-2 rounded-lg border border-gray-200 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleSuggestions.filter((s) => !s.alreadyAdded).length === 0 && visibleCustomNames.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">{t("catalogTemplates.noMoreSuggestions")}</p>
              )}
            </div>
          )}

          {/* Add a custom name not in the suggested list */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t("catalogTemplates.addCustomName")}
              className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
            <button
              onClick={addCustomName}
              disabled={!customName.trim()}
              className="px-4 h-10 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold disabled:opacity-40"
            >
              {t("common.add")}
            </button>
          </div>
        </div>
      </SlidePanel>
    </>
  );
}

function ProductSuggestionImage({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const resolvedUrl = resolveMediaUrl(imageUrl);
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
      {resolvedUrl ? (
        <Image src={resolvedUrl} alt={name} width={48} height={48} unoptimized className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gray-100" aria-hidden="true" />
      )}
    </div>
  );
}
