"use client";

import { useAuthStore } from "@/store/authStore";
import { BellIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useLanguage, type Lang } from "@/i18n/LanguageContext";

interface Props {
  title: string;
  backHref?: string;
}

export default function AppHeader({ title, backHref }: Props) {
  const { user, businesses, currentBusinessId, switchBusiness, isOwner } = useAuthStore();
  const { lang, setLang } = useLanguage();

  const toggleLang = () => setLang(lang === "bn" ? "en" : ("bn" as Lang));

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3">
      {backHref ? (
        <Link href={backHref} className="text-indigo-600 mr-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      ) : null}

      {/* Business switcher — owner only */}
      {isOwner() && businesses.length > 1 ? (
        <select
          value={currentBusinessId ?? ""}
          onChange={(e) => switchBusiness(e.target.value)}
          className="text-sm font-semibold text-gray-900 border-none outline-none bg-transparent"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      ) : (
        <span className="text-[15px] font-semibold text-gray-900 flex-1">{title}</span>
      )}

      <div className="ml-auto flex items-center gap-3">
        {!backHref && (
          <>
            <button
              onClick={toggleLang}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 leading-none"
              title="Switch language"
            >
              {lang === "bn" ? "EN" : "বাং"}
            </button>
            <Link href="/notifications" className="relative text-gray-500">
              <BellIcon className="w-6 h-6" />
            </Link>
            <span className="text-xs text-gray-400">{user?.name}</span>
          </>
        )}
      </div>
    </header>
  );
}
