"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCurrentSubscription } from "@/lib/subscriptionsApi";
import { useLanguage } from "@/i18n/LanguageContext";

const WARNING_WINDOW_DAYS = 14;

export default function TrialBanner() {
  const { t } = useLanguage();
  const { data: status } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getCurrentSubscription,
    staleTime: 5 * 60 * 1000,
  });

  if (!status || status.status !== "TRIALING" || !status.trialEndsAt) return null;

  const daysLeft = Math.ceil(
    (new Date(status.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft > WARNING_WINDOW_DAYS) return null;

  const isExpired = daysLeft <= 0;

  return (
    <Link
      href="/more/settings/subscription"
      className={`block px-4 py-2 text-xs font-medium text-center ${
        isExpired ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {isExpired
        ? t("settings.expiredBadge")
        : t("settings.trialEndsOn", { date: new Date(status.trialEndsAt).toLocaleDateString() })}
      {" · "}
      <span className="underline">{t("settings.subscribeNow")}</span>
    </Link>
  );
}
