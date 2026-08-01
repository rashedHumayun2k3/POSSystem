"use client";

import { useConnectivityStore } from "@/store/connectivityStore";
import { usePendingSalesCount } from "@/lib/posSync";
import { useLanguage } from "@/i18n/LanguageContext";

// Always-visible status pill in the header (every screen, not just POS) — a cashier or owner
// needs "we're fine" confirmed just as much as "we're not". isOnline comes from the connectivity
// store (real request success/failure, see useConnectivityWatcher), not the browser's own
// online/offline event, which can lie on a wifi link that isn't actually routing anywhere.
// pending count is global (SQLite/Dexie queue), so it's accurate on any page, not just /pos.
export default function ConnectivityPill() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const pending = usePendingSalesCount();
  const { t } = useLanguage();

  if (isOnline && pending === 0) {
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title={t("connectivity.online")} />;
  }

  if (!isOnline) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        {t("connectivity.offlineShort")}
        {pending > 0 ? ` · ${pending}` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-amber-600">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      {t("connectivity.syncing", { count: pending })}
    </span>
  );
}
