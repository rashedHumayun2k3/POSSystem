import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { createQueryClient } from "./cache";

export default function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => {
    if (Platform.OS === "web") return;
    focusManager.setFocused(AppState.currentState === "active");
    const listener = AppState.addEventListener("change", state => focusManager.setFocused(state === "active"));
    return () => { listener.remove(); focusManager.setFocused(undefined); };
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
