import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { pickerKey, type CacheResource } from "./cache";

export function useDebouncedSearch(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), value ? delay : 0);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return value ? debounced : "";
}

export function usePickerQuery<T>(resource: CacheResource, path: string, enabled: boolean, branchId?: string) {
  const auth = useAuth();
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(useCallback(() => { setScreenFocused(true); return () => setScreenFocused(false); }, []));
  const effectiveBranch = branchId ?? auth.session?.branchId;
  return useQuery({
    queryKey: pickerKey(resource, auth.session?.businessId, effectiveBranch, path),
    enabled: enabled && screenFocused && !!auth.session?.businessId,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    // Recovery for missed events, scheduled price changes and disconnected hubs.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => auth.api<T>(path, {
      signal,
      ...(effectiveBranch ? { headers: { "X-Branch-Id": effectiveBranch } } : {}),
    }),
  });
}
