"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import FaqAccordion from "@/components/shared/FaqAccordion";

export default function FaqPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("more.faq")}</h1>
      </div>

      <div className="px-4 pt-4">
        <FaqAccordion lang={lang} />
      </div>
    </div>
  );
}
