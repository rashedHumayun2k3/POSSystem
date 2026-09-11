"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import CourierManager from "@/components/settings/CourierManager";

export default function CouriersPage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t("settings.couriersTitle")}</h1>
      </div>

      <div className="px-4 pt-4">
        <CourierManager />
      </div>
    </div>
  );
}
