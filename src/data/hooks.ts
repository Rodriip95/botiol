import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Candle, CedearQuote, MarketSnapshot, SavedEntry } from '../lib/types';
import { market } from './providers';
import { entriesRepo } from './entries';
import { useAuth } from '../auth/AuthContext';

export function useMarket() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await market.getSnapshot());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos traer las cotizaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const bySymbol = useMemo(
    () => new Map<string, CedearQuote>((snapshot?.quotes ?? []).map((q) => [q.symbol, q])),
    [snapshot],
  );
  return { snapshot, bySymbol, error, loading, reload: load };
}

export function useHistory(symbol: string | null) {
  const [state, setState] = useState<{ symbol: string | null; data: Candle[]; loading: boolean; error: string | null }>({
    symbol: null,
    data: [],
    loading: false,
    error: null,
  });
  useEffect(() => {
    if (!symbol) return;
    let alive = true;
    setState({ symbol, data: [], loading: true, error: null });
    market
      .getHistory(symbol)
      .then((data) => alive && setState({ symbol, data, loading: false, error: null }))
      .catch((e: unknown) =>
        alive && setState({ symbol, data: [], loading: false, error: e instanceof Error ? e.message : 'Error' }),
      );
    return () => {
      alive = false;
    };
  }, [symbol]);
  return state.symbol === symbol ? state : { symbol, data: [], loading: !!symbol, error: null };
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
