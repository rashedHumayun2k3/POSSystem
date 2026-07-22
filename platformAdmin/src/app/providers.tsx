"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { hydrateAdminAuth } from "@/store/adminAuthStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  );

  useEffect(() => {
    hydrateAdminAuth();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
