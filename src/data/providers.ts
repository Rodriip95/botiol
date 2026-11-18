import type { Candle, CedearQuote, MarketProvider, MarketSnapshot } from '../lib/types';
import { CATALOG, CATALOG_BY_SYMBOL } from './catalog';

const DAY_MS = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Mock: datos de ejemplo deterministas, sin red                       */
/* ------------------------------------------------------------------ */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** PRNG mulberry32: misma semilla, misma serie. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t + t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOCK_MEP = 1575;
const MOCK_HISTORY_DAYS = 365 * 4;

function mockHistory(symbol: string, last: number): Candle[] {
  const rand = rng(hash(symbol));
  // Deriva diaria: inflación en pesos + crecimiento; volatilidad según el ticker.
  const drift = 0.0007 + (rand() - 0.5) * 0.0006;
  const vol = 0.011 + rand() * 0.01;
  const out: Candle[] = [];
  let price = last;
  const today = new Date();
  for (let i = 0; i <= MOCK_HISTORY_DAYS; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.push({ date: ymd(d), close: Math.round(price * 100) / 100 });
    // Box-Muller para un paso normal.
    const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    price = price / Math.exp(drift + vol * z);
  }
  return out.reverse();
}

export const mockProvider: MarketProvider = {
  id: 'mock',
  async getSnapshot() {
    await new Promise((r) => setTimeout(r, 350)); // simula la latencia de red
    const quotes: CedearQuote[] = CATALOG.map(({ symbol, name, sector, seed: [price, changePct, volume, usd] }) => {
      const spread = price * 0.0015;
      return {
        symbol,
        name,
        sector,
        last: price,
        bid: Math.round((price - spread) * 100) / 100,
        ask: Math.round((price + spread) * 100) / 100,
        changePct,
        volume,
        trades: Math.max(1, Math.round(Math.sqrt(volume) * 1.7)),
        usdMep: usd,
      };
    });
    return { quotes, mep: MOCK_MEP, updatedAt: new Date(), source: 'mock' };
  },
  async getHistory(symbol) {
    const item = CATALOG_BY_SYMBOL.get(symbol);
    return item ? mockHistory(symbol, item.seed[0]) : [];
  },
};

/* ------------------------------------------------------------------ */
/* data912: https://data912.com (gratis, sin key, CORS habilitado)     */
/* ------------------------------------------------------------------ */

interface D912Live {
  symbol: string;
  px_bid: number;
  px_ask: number;
  c: number;
  v: number;
  q_op: number;
  pct_change: number;
}
interface D912Mep {
  close: number;
  v_ars: number;
}
interface D912Hist {
  date: string;
  c: number;
}

const D912 = 'https://data912.com';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`data912 respondió ${res.status}`);
  return (await res.json()) as T;
}

/** Mediana del MEP implícito de las especies con volumen en pesos (descarta outliers). */
function medianMep(rows: D912Mep[]): number | null {
  const v = rows
    .filter((r) => r.close > 0 && r.v_ars > 1_000_000)
    .map((r) => r.close)
    .sort((a, b) => a - b);
  if (v.length === 0) return null;
  return v[Math.floor(v.length / 2)] ?? null;
}

export function normalizeData912(rows: D912Live[]): CedearQuote[] {
  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  // Una especie es "variante en dólares" si termina en D o C, existe la base,
  // y su precio es mucho menor que el de la base (ej. AAPLD 19 vs AAPL 29.920).
  const isUsdVariant = (r: D912Live) => {
    if (!/[CD]$/.test(r.symbol)) return false;
    const base = bySymbol.get(r.symbol.slice(0, -1));
    return !!base && base.c > 0 && r.c > 0 && base.c / r.c > 100;
  };
  return rows
    .filter((r) => !isUsdVariant(r) && r.c > 0)
    .map((r) => {
      const meta = CATALOG_BY_SYMBOL.get(r.symbol);
      const d = bySymbol.get(`${r.symbol}D`);
      return {
        symbol: r.symbol,
        name: meta?.name ?? r.symbol,
        sector: meta?.sector ?? 'Otros',
        last: r.c,
        bid: r.px_bid,
        ask: r.px_ask,
        changePct: r.pct_change,
        volume: r.v,
        trades: r.q_op,
        usdMep: d && d.c > 0 ? d.c : null,
      } satisfies CedearQuote;
    });
}

export const data912Provider: MarketProvider = {
  id: 'data912',
  async getSnapshot(): Promise<MarketSnapshot> {
    const [live, mep] = await Promise.all([
      getJson<D912Live[]>(`${D912}/live/arg_cedears`),
      getJson<D912Mep[]>(`${D912}/live/mep`).catch(() => [] as D912Mep[]),
    ]);
    return { quotes: normalizeData912(live), mep: medianMep(mep), updatedAt: new Date(), source: 'data912' };
  },
  async getHistory(symbol) {
    const rows = await getJson<D912Hist[]>(`${D912}/historical/cedears/${encodeURIComponent(symbol)}`);
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => r.c > 0).map((r) => ({ date: r.date, close: r.c }));
  },
};

/* ------------------------------------------------------------------ */
/* Selección y caché                                                   */
/* ------------------------------------------------------------------ */

/**
 * Proveedor activo. Sin VITE_DATA_PROVIDER: data912 en el build de producción y mock en `pnpm dev`,
 * así la web publicada nunca muestra precios de ejemplo por olvidarse la variable (vite.config.ts lo valida).
 * La caché, los reintentos y el refresco los maneja TanStack Query (ver data/hooks.ts).
 */
const providerId = import.meta.env.VITE_DATA_PROVIDER ?? (import.meta.env.PROD ? 'data912' : 'mock');
export const market: MarketProvider = providerId === 'data912' ? data912Provider : mockProvider;
