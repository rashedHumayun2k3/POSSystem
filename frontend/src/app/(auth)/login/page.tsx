"use client";

import { useState } from "react";
import { useLogin } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const { t, lang, setLang } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ phone, password });
  };

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
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.appName")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("auth.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {/* Phone */}
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

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.password")}</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
            >
              {showPassword ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
        </div>

        {/* Error */}
        {login.isError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {(login.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("auth.loginFailed")}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
        >
          {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <p className="text-center text-xs text-gray-400">{t("auth.forgotPasswordHint")}</p>

        {/* Language toggle on login page */}
        <button
          type="button"
          onClick={() => setLang(lang === "bn" ? "en" : "bn")}
          className="w-full text-xs text-gray-400 text-center pt-1"
        >
          {lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
        </button>
      </form>
    </div>
  );
}
