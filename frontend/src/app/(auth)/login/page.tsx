"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLogin } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import { useToastStore } from "@/store/toastStore";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const { t, lang, setLang } = useLanguage();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("resetSuccess") === "1";

  useEffect(() => {
    if (resetSuccess) useToastStore.getState().show(t("auth.forgotPassword.success"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ phone, password }, { onError: (err) => toastError(err, t("auth.loginFailed")) });
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo / branding */}
      <div className="text-center mb-8">
        <Image src="/logo.png" alt="LavLokshan" width={240} height={67} className="mx-auto mb-3 object-contain" priority />
        <p className="text-sm text-gray-500">{t("auth.subtitle")}</p>
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

        {/* Submit */}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
        >
          {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <p className="text-center text-xs text-gray-400">
          <Link href="/forgot-password" className="text-indigo-600 font-medium">
            {t("auth.forgotPassword.link")}
          </Link>
        </p>
        <p className="text-center text-[11px] text-gray-400">{t("auth.forgotPassword.noEmailFallback")}</p>

        <p className="text-center text-xs text-gray-500">
          {t("auth.signup.noAccount")}{" "}
          <Link href="/signup" className="text-indigo-600 font-medium">
            {t("auth.signup.createAccount")}
          </Link>
        </p>

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
