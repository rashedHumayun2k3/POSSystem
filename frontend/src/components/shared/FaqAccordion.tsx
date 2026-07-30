"use client";

import { useState } from "react";
import { FAQ_ENTRIES, faqText } from "@/lib/faqContent";

export default function FaqAccordion({ lang }: { lang: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQ_ENTRIES.map((entry, i) => {
        const { question, answer } = faqText(entry, lang);
        const isOpen = openIndex === i;
        return (
          <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
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
  );
}
