"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { getSettingsMenuItems } from "@/lib/settingsMenu";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export default function SettingsPage() {
  const { t } = useLanguage();
  const isOwner = useAuthStore((s) => s.isOwner());

  const sections = getSettingsMenuItems(isOwner);

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 space-y-2">
        {sections.map(({ href, icon: Icon, color, titleKey, descKey }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-4 py-4 active:scale-[0.99] transition"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t(titleKey)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t(descKey)}</p>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
