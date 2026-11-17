import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Candle, CedearQuote, SavedEntry } from '../lib/types';
import { isMarketOpen } from '../lib/marketHours';
import { market } from './providers';
import { entriesRepo } from './entries';
import { useAuth } from '../auth/AuthContext';

const SNAPSHOT_REFRESH_OPEN_MS = 60_000;
const SNAPSHOT_REFRESH_CLOSED_MS = 30 * 60_000;
const HISTORY_STALE_MS = 60 * 60_000;
const NO_CANDLES: Candle[] = [];

export const queryKeys = {
  snapshot: ['market', 'snapshot'] as const,
  history: (symbol: string) => ['market', 'history', symbol] as const,
};

const historyQuery = (symbol: string) => ({
  queryKey: queryKeys.history(symbol),
  queryFn: () => market.getHistory(symbol),
  // Son cierres diarios: no cambian durante el día.
  staleTime: HISTORY_STALE_MS,
});

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function useMarket() {
  const q = useQuery({
    queryKey: queryKeys.snapshot,
    queryFn: () => market.getSnapshot(),
    staleTime: 30_000,
    // Cada minuto en horario de BYMA; fuera de horario el precio no se mueve.
    // Con la pestaña en segundo plano no se refresca (refetchIntervalInBackground: false por defecto).
    refetchInterval: () => (isMarketOpen() ? SNAPSHOT_REFRESH_OPEN_MS : SNAPSHOT_REFRESH_CLOSED_MS),
  });
  const snapshot = q.data ?? null;
  const bySymbol = useMemo(
    () => new Map<string, CedearQuote>((snapshot?.quotes ?? []).map((x) => [x.symbol, x])),
    [snapshot],
  );
  return {
    snapshot,
    bySymbol,
    error: q.error ? errorMessage(q.error, 'No pudimos traer las cotizaciones') : null,
    loading: q.isPending,
    reload: () => q.refetch(),
  };
}

export function useHistory(symbol: string | null) {
  const q = useQuery({ ...historyQuery(symbol ?? ''), enabled: !!symbol });
  return {
    symbol,
    data: q.data ?? NO_CANDLES,
    loading: !!symbol && q.isPending,
    error: q.error ? errorMessage(q.error, 'Error') : null,
  };
}

/** Históricos de varios símbolos (los del portfolio). Si uno falla, queda vacío y el resto se muestra igual. */
export function useHistories(symbols: string[]) {
  const key = symbols.join(',');
  // combine estable: TanStack solo lo vuelve a correr cuando cambian los resultados, así el Map no se recrea en cada render.
  const combine = useCallback(
    (results: UseQueryResult<Candle[]>[]) => {
      const list = key ? key.split(',') : [];
      return {
        data: new Map(list.map((s, i) => [s, results[i]?.data ?? NO_CANDLES])),
        loading: results.some((r) => r.isPending),
      };
    },
    [key],
  );
  return useQueries({ queries: symbols.map(historyQuery), combine });
}

export function useEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    return entriesRepo.subscribe(user.uid, setEntries, (e) => setError(e.message));
  }, [user]);
  return { entries, error, uid: user?.uid ?? null };
}
