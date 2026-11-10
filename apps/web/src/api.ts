import type { ApiError, Quote } from '@bot-iol/shared';

export async function fetchQuote(symbol: string): Promise<Quote> {
  const res = await fetch(`/api/quotes/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as Quote;
}
