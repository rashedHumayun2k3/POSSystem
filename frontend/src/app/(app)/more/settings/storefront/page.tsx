"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  downloadStorefrontWebsite,
  getStorefrontSettings,
  updateStorefrontSettings,
  updateWebsiteSettings,
  setSubdomain,
  setStorefrontEnabled,
  updateBusinessBanner,
  updateBusinessLogo,
  updateStorefrontTheme,
  updateWebsite,
} from "@/lib/storefrontApi";
import { STOREFRONT_THEME_PRESETS } from "@/lib/storefrontThemes";
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
  const [websiteInput, setWebsiteInput] = useState("");
  const [websiteContent, setWebsiteContent] = useState<{
    faviconUrl: string;
    sliderImageUrls: string[];
    aboutText: string;
    contactPhone: string;
    whatsappNumber: string;
    contactEmail: string;
    address: string;
    deliveryPolicy: string;
    returnPolicy: string;
    privacyPolicy: string;
    termsPolicy: string;
  }>({
    faviconUrl: "",
    sliderImageUrls: [],
    aboutText: "",
    contactPhone: "",
    whatsappNumber: "",
    contactEmail: "",
    address: "",
    deliveryPolicy: "",
    returnPolicy: "",
    privacyPolicy: "",
    termsPolicy: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["storefront-settings"],
    queryFn: getStorefrontSettings,
  });

  useEffect(() => {
    if (data) {
      setWebsiteInput(data.externalWebsiteUrl ?? "");
      setWebsiteContent({
        faviconUrl: data.websiteSettings?.faviconUrl ?? "",
        sliderImageUrls: data.websiteSettings?.sliderImageUrls ?? [],
        aboutText: data.websiteSettings?.aboutText ?? "",
        contactPhone: data.websiteSettings?.contactPhone ?? "",
        whatsappNumber: data.websiteSettings?.whatsappNumber ?? "",
        contactEmail: data.websiteSettings?.contactEmail ?? "",
        address: data.websiteSettings?.address ?? "",
        deliveryPolicy: data.websiteSettings?.deliveryPolicy ?? "",
        returnPolicy: data.websiteSettings?.returnPolicy ?? "",
        privacyPolicy: data.websiteSettings?.privacyPolicy ?? "",
        termsPolicy: data.websiteSettings?.termsPolicy ?? "",
      });
    }
  }, [data]);

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

  const websiteMutation = useMutation({
    mutationFn: (value: string) => updateWebsite(value.trim() || null),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const bannerMutation = useMutation({
    mutationFn: (value: string | null) => updateBusinessBanner(value),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const websiteContentMutation = useMutation({
    mutationFn: () => updateWebsiteSettings({
      ...websiteContent,
      sliderImageUrls: websiteContent.sliderImageUrls.filter(Boolean),
    }),
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const themeMutation = useMutation({
    mutationFn: updateStorefrontTheme,
    onSuccess: (result) => {
      qc.setQueryData(["storefront-settings"], (prev: typeof data) => (prev ? { ...prev, ...result } : prev));
    },
    onError: (err) => toastError(err, t("settings.failedSaveStorefront")),
  });

  const downloadMutation = useMutation({
    mutationFn: downloadStorefrontWebsite,
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onError: (err) => toastError(err, t("settings.websiteDownloadFailed")),
  });

  const showOnMarketplace = data?.showOnMarketplace ?? false;
  const subdomain = data?.subdomain ?? null;
  const storefrontEnabled = data?.storefrontEnabled ?? false;
  const logoUrl = data?.logoUrl ?? null;
  const bannerUrl = data?.bannerUrl ?? null;
  const selectedThemeId = data?.storefrontThemeId ?? "clean-light";

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

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("settings.businessWebsite")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("settings.businessWebsiteDesc")}</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder={t("settings.websitePlaceholder")}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
                <button
                  onClick={() => websiteMutation.mutate(websiteInput)}
                  disabled={websiteMutation.isPending || websiteInput.trim() === (data?.externalWebsiteUrl ?? "")}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-50"
                >
                  {websiteMutation.isPending ? t("common.saving") : t("common.save")}
                </button>
              </div>
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

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-1">
              <p className="text-sm font-semibold text-gray-900">Website banner</p>
              <p className="text-xs text-gray-400 mb-2">Shown at the top of the shop website. If missing, customers see a simple branded welcome banner.</p>
              <ImageUploadField
                value={bannerUrl}
                onChange={(url) => bannerMutation.mutate(url)}
                label="Upload banner"
                uploadingLabel="Uploading banner..."
                errorLabel="Banner upload failed"
                removeLabel="Remove banner"
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("settings.myWebsite")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("settings.myWebsiteDesc")}</p>
              </div>

              <div className="rounded-lg bg-gray-50 px-3 py-2 space-y-1">
                <p className="text-xs text-gray-400">{t("settings.websiteDomain")}</p>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {data?.externalWebsiteUrl ?? t("settings.websiteDomainNotSet")}
                </p>
              </div>

              <button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending || !subdomain || !storefrontEnabled}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {downloadMutation.isPending ? t("settings.preparingWebsite") : t("settings.downloadMyWebsite")}
              </button>

              {(!subdomain || !storefrontEnabled) && (
                <p className="text-xs text-amber-600">{t("settings.websiteDownloadRequiresStorefront")}</p>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Website content</p>
                <p className="text-xs text-gray-400 mt-1">Optional details for Contact, About, policies, favicon, and slider images.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ImageUploadField
                  value={websiteContent.faviconUrl || null}
                  onChange={(url) => setWebsiteContent((p) => ({ ...p, faviconUrl: url ?? "" }))}
                  label="Upload favicon"
                  uploadingLabel="Uploading favicon..."
                  errorLabel="Favicon upload failed"
                  removeLabel="Remove favicon"
                />
                <TextField label="Contact phone" value={websiteContent.contactPhone} onChange={(v) => setWebsiteContent((p) => ({ ...p, contactPhone: v }))} />
                <TextField label="WhatsApp number" value={websiteContent.whatsappNumber} onChange={(v) => setWebsiteContent((p) => ({ ...p, whatsappNumber: v }))} />
                <TextField label="Contact email" value={websiteContent.contactEmail} onChange={(v) => setWebsiteContent((p) => ({ ...p, contactEmail: v }))} />
              </div>

              <SliderImagesEditor
                value={websiteContent.sliderImageUrls}
                onChange={(sliderImageUrls) => setWebsiteContent((p) => ({ ...p, sliderImageUrls }))}
              />
              <TextArea label="Address" rows={2} value={websiteContent.address} onChange={(v) => setWebsiteContent((p) => ({ ...p, address: v }))} />
              <RichTextEditor label="About us" value={websiteContent.aboutText} onChange={(v) => setWebsiteContent((p) => ({ ...p, aboutText: v }))} />
              <RichTextEditor label="Delivery policy" value={websiteContent.deliveryPolicy} onChange={(v) => setWebsiteContent((p) => ({ ...p, deliveryPolicy: v }))} />
              <RichTextEditor label="Return policy" value={websiteContent.returnPolicy} onChange={(v) => setWebsiteContent((p) => ({ ...p, returnPolicy: v }))} />
              <RichTextEditor label="Privacy policy" value={websiteContent.privacyPolicy} onChange={(v) => setWebsiteContent((p) => ({ ...p, privacyPolicy: v }))} />
              <RichTextEditor label="Terms and conditions" value={websiteContent.termsPolicy} onChange={(v) => setWebsiteContent((p) => ({ ...p, termsPolicy: v }))} />

              <button
                onClick={() => websiteContentMutation.mutate()}
                disabled={websiteContentMutation.isPending}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {websiteContentMutation.isPending ? t("common.saving") : "Save website content"}
              </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Website theme</p>
                <p className="text-xs text-gray-400 mt-1">Choose the colors customers see in your downloadable website.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STOREFRONT_THEME_PRESETS.map((theme) => {
                  const selected = selectedThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => themeMutation.mutate(theme.id)}
                      disabled={themeMutation.isPending || selected}
                      className={`text-left rounded-xl border p-3 transition disabled:cursor-default ${
                        selected ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div
                        className="h-24 rounded-lg overflow-hidden border"
                        style={{ background: theme.background, borderColor: theme.surface }}
                      >
                        <div style={{ background: theme.header }} className="h-7 px-2 flex items-center gap-1.5">
                          <span style={{ background: theme.accent }} className="w-3.5 h-3.5 rounded-full" />
                          <span style={{ background: theme.headerMuted }} className="h-2 w-14 rounded-full" />
                        </div>
                        <div className="p-2 space-y-2">
                          <div style={{ background: theme.surface }} className="rounded-md p-2 shadow-sm">
                            <div style={{ background: theme.text }} className="h-2 w-20 rounded-full" />
                            <div style={{ background: theme.mutedText }} className="h-1.5 w-14 rounded-full mt-1.5 opacity-70" />
                            <div style={{ background: theme.accent }} className="h-4 w-16 rounded-md mt-2" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{theme.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{theme.description}</p>
                        </div>
                        {selected && <span className="text-xs font-semibold text-indigo-600">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function SliderImagesEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const images = value.length > 0 ? value : [""];

  const setAt = (index: number, url: string | null) => {
    const next = [...images];
    next[index] = url ?? "";
    onChange(next.filter((item, i) => item || i === index));
  };

  const removeAt = (index: number) => {
    const next = images.filter((_, i) => i !== index).filter(Boolean);
    onChange(next.length > 0 ? next : [""]);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-medium text-gray-500">Slider images</p>
          <p className="text-xs text-gray-400">Upload up to 5 banners for the website carousel.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...images.filter(Boolean), ""].slice(0, 5))}
          disabled={images.length >= 5}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 disabled:opacity-40"
        >
          Add image
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {images.slice(0, 5).map((url, index) => (
          <div key={index} className="relative rounded-xl border border-gray-100 p-2">
            <ImageUploadField
              value={url || null}
              onChange={(nextUrl) => setAt(index, nextUrl)}
              label={`Upload slider image ${index + 1}`}
              uploadingLabel="Uploading slider image..."
              errorLabel="Slider image upload failed"
              removeLabel="Remove slider image"
            />
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="mt-2 text-xs font-medium text-red-500"
              >
                Remove this slide
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RichTextEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  const run = (command: string, commandValue?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(ref.current?.innerHTML ?? "");
  };

  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 bg-gray-50 px-2 py-2">
          <EditorButton label="B" onClick={() => run("bold")} />
          <EditorButton label="I" onClick={() => run("italic")} />
          <EditorButton label="• List" onClick={() => run("insertUnorderedList")} />
          <EditorButton label="1. List" onClick={() => run("insertOrderedList")} />
          <EditorButton label="H2" onClick={() => run("formatBlock", "h2")} />
          <EditorButton label="P" onClick={() => run("formatBlock", "p")} />
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? "")}
          className="min-h-36 px-3 py-2.5 text-sm text-gray-800 outline-none prose prose-sm max-w-none"
        />
      </div>
    </label>
  );
}

function EditorButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-8 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 active:bg-gray-100"
    >
      {label}
    </button>
  );
}
