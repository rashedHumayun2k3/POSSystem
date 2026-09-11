"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

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

// Hands the raw Google ID token to the caller rather than performing any API call itself —
// unlike clientPage's GoogleSignInButton (which always means "log in now"), this one gets reused
// for signup-email-verification, where the token is just one step before the rest of the form.
export default function GoogleSignInButton({ onSuccess }: { onSuccess: (idToken: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !CLIENT_ID || !window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => onSuccess(response.credential),
    });
    window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 280 });
  }, [scriptLoaded, onSuccess]);

  if (!CLIENT_ID) {
    return null;
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div ref={buttonRef} />
    </>
  );
}
