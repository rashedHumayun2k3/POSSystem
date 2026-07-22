"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRequestPasswordResetCode,
  useVerifyPasswordResetCode,
  useCompletePasswordReset,
  useFindMyEmail,
} from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import { useToastStore } from "@/store/toastStore";
import type { FindMyEmailResponse } from "@/types/auth";

type Step = "email" | "code" | "password";
const STEPS: Step[] = ["email", "code", "password"];

// A separate branch outside the STEPS wizard above — not counted in its progress bar since it's
// an optional detour, not part of the linear reset flow.
type WizardView = Step | "find-email";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [step, setStep] = useState<WizardView>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [findPhone, setFindPhone] = useState("");
  const [findShopName, setFindShopName] = useState("");
  const [findResult, setFindResult] = useState<FindMyEmailResponse | null>(null);

  const requestCode = useRequestPasswordResetCode();
  const verifyCode = useVerifyPasswordResetCode();
  const completeReset = useCompletePasswordReset();
  const findMyEmail = useFindMyEmail();

  const stepIndex = STEPS.indexOf(step as Step);

  function startCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function goBack() {
    if (stepIndex <= 0) return;
    setStep(STEPS[stepIndex - 1]);
  }

  function openFindEmail() {
    setFindResult(null);
    setStep("find-email");
  }

  function handleFindEmail(e: React.FormEvent) {
    e.preventDefault();
    setFindResult(null);
    findMyEmail.mutate(
      { phone: findPhone, shopName: findShopName },
      {
        onSuccess: (data) => {
          setFindResult(data);
          if (!data.found) useToastStore.getState().show(t("auth.forgotPassword.findEmailNotFound"), "error");
        },
        onError: (err) => toastError(err, t("auth.forgotPassword.findEmailFailed")),
      }
    );
  }

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    requestCode.mutate(
      { email },
      {
        // Backend now returns 400 EMAIL_NOT_FOUND for an unregistered email (explicit by request —
        // see AuthService.RequestPasswordResetCodeAsync), so onError below surfaces that directly.
        onSuccess: () => {
          setStep("code");
          startCooldown();
        },
        onError: (err) => toastError(err, t("auth.forgotPassword.requestCodeFailed")),
      }
    );
  }

  function handleResend() {
    if (resendCooldown > 0) return;
    requestCode.mutate(
      { email },
      {
        onSuccess: () => startCooldown(),
        onError: (err) => toastError(err, t("auth.forgotPassword.requestCodeFailed")),
      }
    );
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    verifyCode.mutate(
      { email, code },
      {
        onSuccess: () => setStep("password"),
        onError: (err) => toastError(err, t("auth.forgotPassword.verifyCodeFailed")),
      }
    );
  }

  function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      useToastStore.getState().show(t("auth.forgotPassword.passwordMismatch"), "error");
      return;
    }
    completeReset.mutate(
      { email, newPassword },
      {
        onSuccess: () => router.replace("/login?resetSuccess=1"),
        onError: (err) => toastError(err, t("auth.forgotPassword.completeFailed")),
      }
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.forgotPassword.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("auth.forgotPassword.subtitle")}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {/* Step progress — hidden for the "find-email" detour, which isn't part of this bar */}
        {step !== "find-email" && (
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} className="text-gray-400 p-1 -ml-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex gap-1 flex-1">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full flex-1 transition-all ${
                    i < stepIndex ? "bg-indigo-400" : i === stepIndex ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* STEP: Can't remember email */}
        {step === "find-email" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep("email")} className="text-gray-400 p-1 -ml-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-semibold text-gray-900">{t("auth.forgotPassword.findEmailTitle")}</h2>
            </div>
            <p className="text-sm text-gray-500">{t("auth.forgotPassword.findEmailSubtitle")}</p>
            <form onSubmit={handleFindEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.forgotPassword.findEmailPhone")}</label>
                <input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={findPhone}
                  onChange={(e) => setFindPhone(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.forgotPassword.findEmailShopName")}</label>
                <input
                  type="text"
                  value={findShopName}
                  onChange={(e) => setFindShopName(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {findResult?.found && (
                <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 space-y-1">
                  <p>{t("auth.forgotPassword.findEmailFound")}</p>
                  <p className="font-semibold">{findResult.maskedEmail}</p>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-xs font-medium text-green-800 underline"
                  >
                    {t("auth.forgotPassword.findEmailUseIt")}
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={findMyEmail.isPending}
                className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
              >
                {findMyEmail.isPending ? t("auth.forgotPassword.findEmailSearching") : t("auth.forgotPassword.findEmailButton")}
              </button>
            </form>
          </div>
        )}

        {/* STEP 1: Email */}
        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.forgotPassword.email")}</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={openFindEmail}
                className="mt-1.5 text-xs text-indigo-600 font-medium"
              >
                {t("auth.forgotPassword.cantRememberEmail")}
              </button>
            </div>
            <button
              type="submit"
              disabled={requestCode.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {requestCode.isPending ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.sendCode")}
            </button>
          </form>
        )}

        {/* STEP 2: Verification code */}
        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-gray-500">
              {t("auth.forgotPassword.codeSentTo")} <span className="font-medium text-gray-700">{email}</span>
              {t("auth.forgotPassword.codeSentToSuffix")}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.forgotPassword.code")}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || requestCode.isPending}
              className="text-xs text-indigo-600 disabled:text-gray-400"
            >
              {resendCooldown > 0
                ? `${t("auth.forgotPassword.resendIn")} ${resendCooldown}s`
                : t("auth.forgotPassword.resendCode")}
            </button>
            <button
              type="submit"
              disabled={verifyCode.isPending || code.length !== 6}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {verifyCode.isPending ? t("auth.forgotPassword.verifying") : t("auth.forgotPassword.verifyCode")}
            </button>
          </form>
        )}

        {/* STEP 3: New password */}
        {step === "password" && (
          <form onSubmit={handleComplete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.forgotPassword.newPassword")}</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.forgotPassword.confirmPassword")}</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={completeReset.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {completeReset.isPending ? t("auth.forgotPassword.resetting") : t("auth.forgotPassword.resetPassword")}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 pt-1">
          <Link href="/login" className="text-indigo-600 font-medium">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
