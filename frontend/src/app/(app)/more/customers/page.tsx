"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchCustomers } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";

type Chip = "REPEAT" | "REJECTERS" | "HAS_BAKI" | "HAS_CREDIT";

export default function CustomersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [activeChips, setActiveChips] = useState<Set<Chip>>(new Set());

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", q],
    queryFn: () => searchCustomers(q),
  });

  function toggleChip(c: Chip) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const filtered = customers.filter((c) => {
    if (activeChips.has("REPEAT") && c.orderCount < 2) return false;
    if (activeChips.has("REJECTERS") && !c.isSerialRejecter) return false;
    if (activeChips.has("HAS_BAKI") && c.unpaidBalance <= 0) return false;
    if (activeChips.has("HAS_CREDIT") && c.storeCreditBalance <= 0) return false;
    return true;
  });

  const CHIPS: { key: Chip; label: string }[] = [
    { key: "REPEAT", label: t("customers.chipRepeat") },
    { key: "REJECTERS", label: t("customers.chipRejecters") },
    { key: "HAS_BAKI", label: t("customers.chipHasBaki") },
    { key: "HAS_CREDIT", label: t("customers.chipHasCredit") },
  ];

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("more.customers")}</h1>
      </div>

      <div className="px-4 pt-3 space-y-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("customers.searchPlaceholder")}
          className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map(({ key, label }) => {
            const active = activeChips.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleChip(key)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t("customers.empty")}</p>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/more/customers/${c.id}`}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 active:scale-[0.99] transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  {c.orderCount > 0 && (
                    <span className="shrink-0 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                      {c.orderCount}x
                    </span>
                  )}
                  {c.isSerialRejecter && (
                    <span className="shrink-0 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                      {t("customers.rejecter")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{c.phone}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {c.unpaidBalance > 0 && (
                    <span className="text-xs text-red-600 font-medium">
                      {t("customers.baki")}: ৳{c.unpaidBalance.toLocaleString()}
                    </span>
                  )}
                  {c.storeCreditBalance > 0 && (
                    <span className="text-xs text-green-600 font-medium">
                      {t("customers.credit")}: ৳{c.storeCreditBalance.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
