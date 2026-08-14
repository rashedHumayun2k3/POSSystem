"use client";

import type { ReportPeriod, GroupBy } from "@/types/reports";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  period: ReportPeriod;
  onPeriod: (p: ReportPeriod) => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  showGroupBy?: boolean;
}

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
];

const GROUPS: { key: GroupBy; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function periodToDates(period: ReportPeriod): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const todayStr = fmt(today);
  if (period === "today") return { from: todayStr, to: todayStr };
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "3m" ? 90 : 180;
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: fmt(from), to: todayStr };
}

export default function DateRangeBar({ period, onPeriod, groupBy, onGroupBy, showGroupBy = true }: Props) {
  const { lang } = useLanguage();
  const periodLabel: Record<ReportPeriod, string> = {
    today: lang === "bn" ? "আজ" : "Today",
    "7d": "7D",
    "30d": "30D",
    "3m": "3M",
    "6m": "6M",
  };
  const groupLabel: Record<GroupBy, string> = {
    day: lang === "bn" ? "দিন" : "Day",
    week: lang === "bn" ? "সপ্তাহ" : "Week",
    month: lang === "bn" ? "মাস" : "Month",
  };

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar">
      <div className="flex bg-gray-100 rounded-xl p-0.5 shrink-0">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPeriod(p.key)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
              period === p.key ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"
            }`}
          >
            {periodLabel[p.key] ?? p.label}
          </button>
        ))}
      </div>

      {showGroupBy && period !== "today" && (
        <div className="flex bg-gray-100 rounded-xl p-0.5 shrink-0">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => onGroupBy(g.key)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
                groupBy === g.key ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"
              }`}
            >
              {groupLabel[g.key] ?? g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
