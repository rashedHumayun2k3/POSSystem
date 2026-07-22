"use client";

import Script from "next/script";
import { useState } from "react";
import { facebookLogin, getErrorMessage } from "@/lib/clientPageApi";
import { useClientPageAuthStore } from "@/store/clientPageAuthStore";

const APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? "";

declare global {
  interface Window {
    FB?: {
      init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { accessToken: string } }) => void,
        options: { scope: string }
      ) => void;
    };
  }
}

export default function FacebookSignInButton({ onError }: { onError?: (message: string) => void }) {
  const login = useClientPageAuthStore((s) => s.login);
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!APP_ID) {
    // Hidden until a real Facebook App ID is configured — see NEXT_PUBLIC_FACEBOOK_APP_ID.
    return null;
  }

  function handleClick() {
    if (!sdkReady || !window.FB || busy) return;
    setBusy(true);
    window.FB.login(
      async (response) => {
        const accessToken = response.authResponse?.accessToken;
        if (!accessToken) {
          setBusy(false);
          return;
        }
        try {
          const result = await facebookLogin(accessToken);
          login(result.accessToken, result.name, result.photoUrl);
        } catch (err) {
          onError?.(getErrorMessage(err, "Facebook sign-in failed. Please try again."));
        } finally {
          setBusy(false);
        }
      },
      { scope: "public_profile,email" }
    );
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.FB?.init({ appId: APP_ID, cookie: true, xfbml: false, version: "v19.0" });
          setSdkReady(true);
        }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={!sdkReady || busy}
        className="flex w-[280px] items-center justify-center gap-2 rounded-md bg-[#1877F2] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Continue with Facebook
      </button>
    </>
  );
}
