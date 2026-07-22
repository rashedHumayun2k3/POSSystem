"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStorefrontSettings, updateStorefrontSettings, setSubdomain, setStorefrontEnabled, updateBusinessLogo } from "@/lib/storefrontApi";
import { toastError } from "@/lib/toastError";
import { useLanguage } from "@/i18n/LanguageContext";
import ImageUploadField from "@/components/ui/ImageUploadField";

const CLIENTPAGE_URL = process.env.NEXT_PUBLIC_CLIENTPAGE_URL ?? "http://localhost:3001";

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-colors disabled:opacity-50 ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function StorefrontSettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [subdomainInput, setSubdomainInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["storefront-settings"],
    queryFn: getStorefrontSettings,
  });

  const marketplaceMutation = useMutation({
    mutationFn: (value: boolean) => updateStorefrontSettings(value),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const subdomainMutation = useMutation({
    mutationFn: (value: string) => setSubdomain(value),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
      setSubdomainInput("");
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const enabledMutation = useMutation({
    mutationFn: (value: boolean) => setStorefrontEnabled(value),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const logoMutation = useMutation({
    mutationFn: (value: string | null) => updateBusinessLogo(value),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const showOnMarketplace = data?.showOnMarketplace ?? false;
  const subdomain = data?.subdomain ?? null;
  const storefrontEnabled = data?.storefrontEnabled ?? false;
  const logoUrl = data?.logoUrl ?? null;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("settings.storefrontTitle")}</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {isLoading ? (
          <>
            <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          </>
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-1">
              <p className="text-sm font-semibold text-gray-900">{t("settings.businessLogo")}</p>
              <p className="text-xs text-gray-400 mb-2">{t("settings.businessLogoDesc")}</p>
              <ImageUploadField
                value={logoUrl}
                onChange={(url) => logoMutation.mutate(url)}
                label={t("settings.uploadLogo")}
                uploadingLabel={t("settings.logoUploading")}
                errorLabel={t("settings.logoUploadFailed")}
                removeLabel={t("settings.logoRemove")}
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{t("settings.showOnMarketplace")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("settings.showOnMarketplaceDesc")}</p>
              </div>
              <ToggleSwitch
                checked={showOnMarketplace}
                disabled={marketplaceMutation.isPending}
                onChange={() => marketplaceMutation.mutate(!showOnMarketplace)}
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("settings.myShopPage")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("settings.myShopPageDesc")}</p>
              </div>

              {subdomain ? (
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={`${CLIENTPAGE_URL}/shop/${subdomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-600 font-medium truncate"
                  >
                    {CLIENTPAGE_URL.replace(/^https?:\/\//, "")}/shop/{subdomain}
                  </a>
                  <ToggleSwitch
                    checked={storefrontEnabled}
                    disabled={enabledMutation.isPending}
                    onChange={() => enabledMutation.mutate(!storefrontEnabled)}
                  />
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={subdomainInput}
                  onChange={(e) => setSubdomainInput(e.target.value.toLowerCase())}
                  placeholder={subdomain ?? t("settings.subdomainPlaceholder")}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
                <button
                  onClick={() => subdomainMutation.mutate(subdomainInput.trim())}
                  disabled={subdomainMutation.isPending || !subdomainInput.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-50"
                >
                  {subdomain ? t("settings.changeSubdomain") : t("settings.claimSubdomain")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
