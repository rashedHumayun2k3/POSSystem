"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { googleLogin, getErrorMessage } from "@/lib/clientPageApi";
import { useClientPageAuthStore } from "@/store/clientPageAuthStore";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, options: { theme: string; size: string; width?: number }) => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({ onError }: { onError?: (message: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const login = useClientPageAuthStore((s) => s.login);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !CLIENT_ID || !window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        try {
          const result = await googleLogin(response.credential);
          login(result.accessToken, result.name, result.photoUrl);
        } catch (err) {
          onError?.(getErrorMessage(err, "Google sign-in failed. Please try again."));
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 280 });
  }, [scriptLoaded, login, onError]);

  if (!CLIENT_ID) {
    return <p className="text-xs text-gray-400">Google sign-in isn&apos;t configured yet.</p>;
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div ref={buttonRef} />
    </>
  );
}
