'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep CRM screens responsive while still reconciling changes made by
        // another administrator when a user returns to the portal.
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          const status = typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: unknown }).status)
            : 0;
          if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState (not a module-level singleton) so each request gets its own
  // client on the server, while the client still gets one stable instance
  // across re-renders in the browser.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
