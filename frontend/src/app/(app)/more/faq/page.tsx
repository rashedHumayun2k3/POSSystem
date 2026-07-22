"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import { FAQ_ENTRIES, faqText } from "@/lib/faqContent";

export default function FaqPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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

      <div className="px-4 pt-4 space-y-2">
        {FAQ_ENTRIES.map((entry, i) => {
          const { question, answer } = faqText(entry, lang);
          const isOpen = openIndex === i;
          return (
            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-gray-900">{question}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <p className="px-4 pb-4 text-sm text-gray-500 leading-relaxed">{answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
