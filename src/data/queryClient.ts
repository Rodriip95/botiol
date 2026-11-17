import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // Al volver a la pestaña se actualiza solo si el dato ya está vencido (staleTime de cada query).
      refetchOnWindowFocus: true,
    },
  },
});
