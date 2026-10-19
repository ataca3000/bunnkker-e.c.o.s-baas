import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client with sensible enterprise defaults.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
