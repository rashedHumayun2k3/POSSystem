"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ShopContextProvider } from "@/context/ShopContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* ShopContextProvider uses useSearchParams() (via useResolvedShopSlug), which requires
          a Suspense boundary so it doesn't force the whole app into client-side-only rendering. */}
      <Suspense fallback={null}>
        <ShopContextProvider>{children}</ShopContextProvider>
      </Suspense>
    </QueryClientProvider>
  );
}
