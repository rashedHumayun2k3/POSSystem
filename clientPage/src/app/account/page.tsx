"use client";

import Image from "next/image";
import { useState } from "react";
import TopHeader from "@/components/TopHeader";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import FacebookSignInButton from "@/components/FacebookSignInButton";
import { useClientPageAuthStore } from "@/store/clientPageAuthStore";
import { resolveMediaUrl } from "@/lib/media";

const AccountIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1.4-3.4 4.3-5.2 7.5-5.2s6.1 1.8 7.5 5.2" strokeLinecap="round" />
  </svg>
);

export default function AccountPage() {
  const { token, name, photoUrl, logout } = useClientPageAuthStore();
  const [loginError, setLoginError] = useState<string | null>(null);

  return (
    <main>
      <TopHeader />
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        {token ? (
          <>
            {photoUrl ? (
              <Image src={resolveMediaUrl(photoUrl) ?? ''} alt={name ?? ""} width={64} height={64} className="rounded-full" unoptimized />
            ) : (
              <AccountIcon />
            )}
            <p className="text-sm font-medium text-gray-700">Signed in as {name}</p>
            <p className="text-xs text-gray-400 max-w-[240px]">
              Your sign-in is used only to write product reviews. Checkout itself is still guest — no account needed to order.
            </p>
            <button onClick={logout} className="text-xs text-indigo-600 font-medium mt-1">
              Sign out
            </button>
          </>
        ) : (
          <>
            <AccountIcon />
            <p className="text-sm font-medium text-gray-700">Sign in</p>
            <p className="text-xs text-gray-400 max-w-[240px]">
              Sign in to write product reviews. Checkout itself is still guest — no account needed to order.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <GoogleSignInButton onError={setLoginError} />
              <FacebookSignInButton onError={setLoginError} />
            </div>
            {loginError && <p className="text-xs text-red-600 mt-1">{loginError}</p>}
          </>
        )}
      </div>
    </main>
  );
}
