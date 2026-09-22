"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ImageUploadField from "@/components/ui/ImageUploadField";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  getStorefrontSettings,
  setStorefrontEnabled,
  setSubdomain,
  updateBusinessLogo,
  updateStorefrontSettings,
  updateWebsite,
} from "@/lib/storefrontApi";
import { toastError } from "@/lib/toastError";

const CLIENTPAGE_URL = process.env.NEXT_PUBLIC_CLIENTPAGE_URL ?? "http://localhost:3001";

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-colors disabled:opacity-50 ${checked ? "bg-indigo-600" : "bg-gray-200"}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function StorefrontSettings({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [subdomainInput, setSubdomainInput] = useState("");
  const [websiteInput, setWebsiteInput] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["storefront-settings"], queryFn: getStorefrontSettings });

  const updateCache = (result: object) => {
    qc.setQueryData(["storefront-settings"], (previous: typeof data) => previous ? { ...previous, ...result } : previous);
  };
  const saveError = (error: unknown) => toastError(error, t("settings.failedSaveStorefront"));
  const marketplaceMutation = useMutation({ mutationFn: updateStorefrontSettings, onSuccess: updateCache, onError: saveError });
  const subdomainMutation = useMutation({
    mutationFn: setSubdomain,
    onSuccess: (result) => { updateCache(result); setSubdomainInput(""); },
    onError: saveError,
  });
  const enabledMutation = useMutation({ mutationFn: setStorefrontEnabled, onSuccess: updateCache, onError: saveError });
  const logoMutation = useMutation({ mutationFn: updateBusinessLogo, onSuccess: updateCache, onError: saveError });
  const websiteMutation = useMutation({
    mutationFn: (value: string) => updateWebsite(value.trim() || null),
    onSuccess: (result) => { updateCache(result); setWebsiteInput(null); },
    onError: saveError,
  });

  const showOnMarketplace = data?.showOnMarketplace ?? false;
  const subdomain = data?.subdomain ?? null;
  const storefrontEnabled = data?.storefrontEnabled ?? false;
  const websiteValue = websiteInput ?? data?.externalWebsiteUrl ?? "";

  return (
    <div className={embedded ? "space-y-3" : "px-4 pt-4 space-y-3"}>
      {isLoading ? (
        <><div className="h-20 bg-gray-100 rounded-xl animate-pulse" /><div className="h-32 bg-gray-100 rounded-xl animate-pulse" /></>
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-gray-900">{t("settings.businessLogo")}</p>
            <p className="text-xs text-gray-400 mb-2">{t("settings.businessLogoDesc")}</p>
            <ImageUploadField value={data?.logoUrl ?? null} onChange={(url) => logoMutation.mutate(url)}
              label={t("settings.uploadLogo")} uploadingLabel={t("settings.logoUploading")}
              errorLabel={t("settings.logoUploadFailed")} removeLabel={t("settings.logoRemove")} />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t("settings.businessWebsite")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("settings.businessWebsiteDesc")}</p>
            </div>
            <div className="flex gap-2">
              <input type="url" value={websiteValue} onChange={(event) => setWebsiteInput(event.target.value)}
                placeholder={t("settings.websitePlaceholder")} className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              <button type="button" onClick={() => websiteMutation.mutate(websiteValue)}
                disabled={websiteMutation.isPending || websiteValue.trim() === (data?.externalWebsiteUrl ?? "")}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-50">
                {websiteMutation.isPending ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t("settings.showOnMarketplace")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("settings.showOnMarketplaceDesc")}</p>
            </div>
            <ToggleSwitch checked={showOnMarketplace} disabled={marketplaceMutation.isPending}
              onChange={() => marketplaceMutation.mutate(!showOnMarketplace)} />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t("settings.myShopPage")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("settings.myShopPageDesc")}</p>
            </div>
            {subdomain && (
              <div className="flex items-center justify-between gap-3">
                <a href={`${CLIENTPAGE_URL}/shop/${subdomain}`} target="_blank" rel="noreferrer"
                  className="text-sm text-indigo-600 font-medium truncate">
                  {CLIENTPAGE_URL.replace(/^https?:\/\//, "")}/shop/{subdomain}
                </a>
                <ToggleSwitch checked={storefrontEnabled} disabled={enabledMutation.isPending}
                  onChange={() => enabledMutation.mutate(!storefrontEnabled)} />
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={subdomainInput} onChange={(event) => setSubdomainInput(event.target.value.toLowerCase())}
                placeholder={subdomain ?? t("settings.subdomainPlaceholder")}
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              <button type="button" onClick={() => subdomainMutation.mutate(subdomainInput.trim())}
                disabled={subdomainMutation.isPending || !subdomainInput.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-50">
                {subdomain ? t("settings.changeSubdomain") : t("settings.claimSubdomain")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
