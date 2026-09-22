"use client";

import Link from "next/link";
import { useState } from "react";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { REPORT_MENU_ITEMS } from "@/lib/reportsMenu";
import { sendDailyClosingReport } from "@/lib/reportsApi";
import { getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToastStore } from "@/store/toastStore";

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span
      className={`${className} inline-block rounded-full border-2 border-current border-t-transparent animate-spin`}
      aria-hidden="true"
    />
  );
}

export default function ReportsHubPage() {
  const { lang, t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const [sendingReport, setSendingReport] = useState(false);

  const canOfferClosingReport = user?.role === "OWNER" || user?.role === "MANAGER" || user?.role === "STAFF";
  const isStaff = user?.role === "STAFF";

  const handleSendReport = async () => {
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
    <div className="pb-24">
      <div className="px-4 py-5 space-y-3">
        {canOfferClosingReport && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSendReport}
              disabled={sendingReport}
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

        {REPORT_MENU_ITEMS.map(({ href, icon: Icon, color, titleKey, descKey }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 bg-white rounded-2xl px-4 h-16 border border-gray-100 active:scale-[0.98] transition"
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t(titleKey)}</p>
              <p className="text-xs text-gray-400">{t(descKey)}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
