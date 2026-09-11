"use client";

import { useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { uploadImage } from "@/lib/media";
import { updateMyPhoto } from "@/lib/usersApi";
import { getErrorMessage } from "@/lib/api";
import { sendDailyClosingReport } from "@/lib/reportsApi";
import Avatar from "@/components/ui/Avatar";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToastStore } from "@/store/toastStore";
import { useLogout } from "@/hooks/useAuth";
import { ArrowRightOnRectangleIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

const ROLE_KEY: Record<string, string> = {
  OWNER: "settings.roleOwner",
  MANAGER: "settings.roleManager",
  STAFF: "settings.roleStaff",
  WAREHOUSE: "settings.roleWarehouse",
};

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span
      className={`${className} inline-block rounded-full border-2 border-current border-t-transparent animate-spin`}
      aria-hidden="true"
    />
  );
}

export default function ProfilePage() {
  const { lang, t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const updateUserPhoto = useAuthStore((s) => s.updateUserPhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = useLogout();

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file);
      await updateMyPhoto(url);
      updateUserPhoto(url);
    } catch {
      useToastStore.getState().show(t("profile.uploadFailed"), "error");
    } finally {
      setUploading(false);
    }
  };

  const canOfferClosingReport = user.role === "OWNER" || user.role === "MANAGER" || user.role === "STAFF";
  const isStaff = user.role === "STAFF";
  const logoutNow = async () => {
    setLoggingOut(true);
    await logout();
  };

  const handleLogoutClick = () => {
    if (canOfferClosingReport) {
      setLogoutSheetOpen(true);
      return;
    }
    void logoutNow();
  };

  const handleSendReportAndLogout = async () => {
    setSendingReport(true);
    try {
      const res = await sendDailyClosingReport({ lang });
      useToastStore.getState().show(res.message || t(isStaff ? "profile.dailyReport.sentFallbackStaff" : "profile.dailyReport.sentFallbackOwner"));
      await logoutNow();
    } catch (err) {
      useToastStore.getState().show(getErrorMessage(err, t("profile.dailyReport.failed")), "error");
      setSendingReport(false);
    }
  };

  const handleSendReportOnly = async () => {
    setSendingReport(true);
    try {
      const res = await sendDailyClosingReport({ lang });
      useToastStore.getState().show(res.message || t(isStaff ? "profile.dailyReport.sentFallbackStaff" : "profile.dailyReport.sentFallbackOwner"));
    } catch (err) {
      useToastStore.getState().show(getErrorMessage(err, t("profile.dailyReport.failed")), "error");
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative"
        >
          <Avatar name={user.name} photoUrl={user.photoUrl} size={96} />
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center border-2 border-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-semibold text-indigo-600 disabled:opacity-50"
        >
          {uploading ? t("profile.uploading") : t("profile.changePhoto")}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100">
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t("profile.name")}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{user.name}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t("profile.phone")}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{user.phone}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t("profile.role")}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{t(ROLE_KEY[user.role] ?? "settings.roleStaff")}</p>
        </div>
      </div>

      {canOfferClosingReport && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleSendReportOnly}
            disabled={sendingReport || loggingOut}
            className="flex items-center gap-4 w-full bg-white rounded-2xl px-4 h-16 border border-sky-100 text-sky-700 active:scale-[0.98] transition disabled:opacity-70"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50">
              {sendingReport ? <Spinner className="w-5 h-5 text-sky-600" /> : <EnvelopeIcon className="w-5 h-5 text-sky-600" />}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold">{sendingReport ? t("profile.dailyReport.sendingTitle") : t("profile.dailyReport.button")}</p>
              <p className="text-xs text-sky-500 truncate">
                {sendingReport
                  ? t("profile.dailyReport.sendingSubtitle")
                  : t(isStaff ? "profile.dailyReport.staffSubtitle" : "profile.dailyReport.ownerSubtitle")}
              </p>
            </div>
          </button>
          {sendingReport && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              {t("profile.dailyReport.sendingNotice")}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleLogoutClick}
        disabled={loggingOut}
        className="flex items-center gap-4 w-full bg-white rounded-2xl px-4 h-16 border border-gray-100 text-red-500 active:scale-[0.98] transition"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50">
          <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-sm font-semibold">{t("more.logout")}</p>
      </button>

      {logoutSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLogoutSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <div className="space-y-1 pr-8">
              <p className="text-base font-semibold text-gray-900">
                {t(isStaff ? "profile.dailyReport.logoutStaffTitle" : "profile.dailyReport.logoutOwnerTitle")}
              </p>
              <p className="text-sm text-gray-500">
                {t(isStaff ? "profile.dailyReport.logoutStaffBody" : "profile.dailyReport.logoutOwnerBody")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleSendReportAndLogout}
                disabled={sendingReport || loggingOut}
                className="w-full h-12 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sendingReport && <Spinner className="w-4 h-4" />}
                {sendingReport
                  ? t("profile.dailyReport.sendingTitle")
                  : t(isStaff ? "profile.dailyReport.sendToOwner" : "profile.dailyReport.sendToSelf")}
              </button>
              {sendingReport && (
                <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  {t("profile.dailyReport.logoutSendingNotice")}
                </p>
              )}
              <button
                type="button"
                onClick={logoutNow}
                disabled={sendingReport || loggingOut}
                className="w-full h-12 rounded-xl border border-red-100 bg-red-50 text-red-600 text-sm font-semibold disabled:opacity-60"
              >
                {t("profile.dailyReport.logoutWithoutReport")}
              </button>
              <button
                type="button"
                onClick={() => setLogoutSheetOpen(false)}
                disabled={sendingReport || loggingOut}
                className="w-full h-11 rounded-xl text-gray-500 text-sm font-medium disabled:opacity-60"
              >
                {t("profile.dailyReport.stayInApp")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
