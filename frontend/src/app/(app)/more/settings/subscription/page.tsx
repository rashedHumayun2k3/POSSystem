"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { listPlans, getCurrentSubscription, startCheckout } from "@/lib/subscriptionsApi";
import { useLanguage } from "@/i18n/LanguageContext";

const UNLIMITED = 2147483647;

function errMsg(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

function statusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, { label: string; className: string }> = {
    TRIALING: { label: t("settings.trialBadge"), className: "bg-indigo-100 text-indigo-600" },
    ACTIVE: { label: t("settings.activeBadge"), className: "bg-green-100 text-green-700" },
    PAST_DUE: { label: t("settings.pastDueBadge"), className: "bg-amber-100 text-amber-700" },
    EXPIRED: { label: t("settings.expiredBadge"), className: "bg-red-100 text-red-600" },
    CANCELED: { label: t("settings.canceledBadge"), className: "bg-gray-100 text-gray-500" },
  };
  return map[status] ?? { label: status, className: "bg-gray-100 text-gray-500" };
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const isUnlimited = limit >= UNLIMITED;
  const pct = isUnlimited ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100);
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [checkoutError, setCheckoutError] = useState("");
  const paymentResult = searchParams.get("payment"); // "success" | "failed" | null

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getCurrentSubscription,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: listPlans,
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ planCode, billingCycle }: { planCode: string; billingCycle: "MONTHLY" | "YEARLY" }) =>
      startCheckout(planCode, billingCycle),
    onSuccess: (data) => {
      window.location.href = data.bkashRedirectUrl;
    },
    onError: (err) => setCheckoutError(errMsg(err, t("settings.checkoutFailed"))),
  });

  const badge = status ? statusBadge(status.status, t) : null;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t("settings.subscriptionTitle")}</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {paymentResult === "success" && (
          <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">{t("settings.paymentSuccess")}</p>
        )}
        {paymentResult === "failed" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">{t("settings.paymentFailed")}</p>
        )}

        {/* Current plan card */}
        {statusLoading ? (
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        ) : status ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{t("settings.currentPlan")}</p>
              {badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-gray-900">{status.planName}</p>

            {status.status === "TRIALING" && status.trialEndsAt && (
              <p className="text-xs text-gray-500">
                {t("settings.trialEndsOn", { date: new Date(status.trialEndsAt).toLocaleDateString() })}
              </p>
            )}
            {status.status === "ACTIVE" && status.currentPeriodEnd && (
              <p className="text-xs text-gray-500">
                {t("settings.renewsOn", { date: new Date(status.currentPeriodEnd).toLocaleDateString() })}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 pt-1">
              <UsageBar
                used={status.staffSeatsUsed}
                limit={status.staffSeatLimit}
                label={t("settings.staffSeatsUsage", {
                  used: status.staffSeatsUsed,
                  limit: status.staffSeatLimit >= UNLIMITED ? t("settings.unlimited") : status.staffSeatLimit,
                })}
              />
              <UsageBar
                used={status.branchesUsed}
                limit={status.branchLimit}
                label={t("settings.branchesUsage", {
                  used: status.branchesUsed,
                  limit: status.branchLimit >= UNLIMITED ? t("settings.unlimited") : status.branchLimit,
                })}
              />
            </div>
          </div>
        ) : null}

        {/* Available plans */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t("settings.availablePlans")}
          </p>
          <div className="space-y-2">
            {plansLoading
              ? [1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)
              : plans.map((plan) => {
                  const isCurrent = status?.planCode === plan.code && status.status === "ACTIVE";
                  return (
                    <div key={plan.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                            {t("settings.activeBadge")}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        ৳{plan.priceMonthly.toLocaleString()}
                        <span className="text-xs font-normal text-gray-400">{t("settings.perMonth")}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {plan.staffSeatLimit >= UNLIMITED ? t("settings.unlimited") : plan.staffSeatLimit} staff ·{" "}
                        {plan.branchLimit >= UNLIMITED ? t("settings.unlimited") : plan.branchLimit} branches
                      </p>
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            setCheckoutError("");
                            checkoutMutation.mutate({ planCode: plan.code, billingCycle: "MONTHLY" });
                          }}
                          disabled={checkoutMutation.isPending}
                          className="w-full h-11 rounded-xl bg-[#e2136e] text-white font-semibold text-sm disabled:opacity-50"
                        >
                          {checkoutMutation.isPending
                            ? t("settings.processingCheckout")
                            : t("settings.subscribeNow")}
                        </button>
                      )}
                    </div>
                  );
                })}
          </div>
          {checkoutError && <p className="text-xs text-red-600 mt-2 px-1">{checkoutError}</p>}
        </div>
      </div>
    </div>
  );
}
