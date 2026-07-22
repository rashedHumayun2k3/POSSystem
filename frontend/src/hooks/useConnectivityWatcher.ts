"use client";

import { useEffect } from "react";
import { useConnectivityStore } from "@/store/connectivityStore";
import { api } from "@/lib/api";

// Two complementary signals: the browser's own online/offline events (instant, but only knows
// about the device's network link — a phone can show "online" on wifi that isn't actually
// routing anywhere), and a one-time startup probe against the backend (proves the server/DB is
// actually reachable, not just that the device has a link). Ongoing detection after that rides
// on the api.ts response interceptor, which flips the store on every real request.
export function useConnectivityWatcher() {
  const setOnline = useConnectivityStore((s) => s.setOnline);

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    api.get("/health").catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);
}
