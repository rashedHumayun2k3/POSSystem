"use client";

import { useState } from "react";
import Link from "next/link";
import { useRequestSignupCode, useVerifySignupCode, useCompleteSignup } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";

type Step = "email" | "code" | "details";
const STEPS: Step[] = ["email", "code", "details"];

const COUNTRY_OPTIONS = ["Bangladesh", "India", "Pakistan", "Nepal", "Sri Lanka", "Myanmar", "Other"];

function errMsg(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function SignUpPage() {
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const requestCode = useRequestSignupCode();
  const verifyCode = useVerifySignupCode();
  const completeSignup = useCompleteSignup();

  const stepIndex = STEPS.indexOf(step);

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
    if (stepIndex === 0) return;
    setError("");
    setStep(STEPS[stepIndex - 1]);
  }

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    requestCode.mutate(
      { email },
      {
        onSuccess: () => {
          setStep("code");
          startCooldown();
        },
        onError: (err) => setError(errMsg(err, t("auth.signup.requestCodeFailed"))),
      }
    );
  }

  function handleResend() {
    if (resendCooldown > 0) return;
    setError("");
    requestCode.mutate(
      { email },
      {
        onSuccess: () => startCooldown(),
        onError: (err) => setError(errMsg(err, t("auth.signup.requestCodeFailed"))),
      }
    );
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    verifyCode.mutate(
      { email, code },
      {
        onSuccess: () => setStep("details"),
        onError: (err) => setError(errMsg(err, t("auth.signup.verifyCodeFailed"))),
      }
    );
  }

  function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    completeSignup.mutate(
      { email, name, phone, password, businessName, country: country.trim() || undefined },
      { onError: (err) => setError(errMsg(err, t("auth.signup.completeFailed"))) }
    );
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo / branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.signup.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("auth.signup.subtitle")}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {/* Step progress */}
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

        {/* STEP 1: Email */}
        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.signup.email")}</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={requestCode.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {requestCode.isPending ? t("auth.signup.sending") : t("auth.signup.sendCode")}
            </button>
          </form>
        )}

        {/* STEP 2: Verification code */}
        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-gray-500">
              {t("auth.signup.codeSentTo")} <span className="font-medium text-gray-700">{email}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.signup.code")}</label>
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
                ? `${t("auth.signup.resendIn")} ${resendCooldown}s`
                : t("auth.signup.resendCode")}
            </button>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={verifyCode.isPending || code.length !== 6}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {verifyCode.isPending ? t("auth.signup.verifying") : t("auth.signup.verifyCode")}
            </button>
          </form>
        )}

        {/* STEP 3: Account + business details */}
        {step === "details" && (
          <form onSubmit={handleComplete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.signup.name")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.phone")}</label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="01700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.password")}</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.signup.businessName")}</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("auth.signup.country")} <span className="text-gray-400">({t("auth.signup.optional")})</span>
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={completeSignup.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {completeSignup.isPending ? t("auth.signup.creating") : t("auth.signup.createAccount")}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 pt-1">
          {t("auth.signup.haveAccount")}{" "}
          <Link href="/login" className="text-indigo-600 font-medium">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
