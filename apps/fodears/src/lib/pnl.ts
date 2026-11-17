import type { Candle, CedearQuote } from './types';

export interface PnlResult {
  symbol: string;
  quantity: number;
  invested: number;
  /** Precio promedio pagado por nominal. */
  avgCost: number;
  price: number;
  /** Valor a precio de último operado. */
  value: number;
  /** Valor si vendieras ya a la punta compradora. */
  liquidationValue: number | null;
  pnl: number;
  pnlPct: number;
  valueUsd: number | null;
  /** Precio por nominal para salir hecho (sin comisiones). */
  breakEven: number;
  /** Cuánto tiene que subir/bajar el precio para llegar al break even. */
  toBreakEvenPct: number;
  date: string | null;
  daysHeld: number | null;
  /** Rendimiento anualizado compuesto (solo con fecha y > 30 días). */
  annualizedPct: number | null;
  /** Cierre del CEDEAR el día de compra (o la rueda anterior más cercana). */
  closeOnDate: number | null;
  /** Diferencia entre lo que pagaste por nominal y ese cierre. */
  paidVsClosePct: number | null;
  benchmark: {
    symbol: string;
    returnPct: number;
    /** Lo que valdría hoy la misma plata invertida en el benchmark. */
    value: number;
    /** Tu rendimiento menos el del benchmark, en puntos porcentuales. */
    alphaPct: number;
  } | null;
  /** Serie para el gráfico: tu posición valorizada desde la fecha de compra (o último año). */
  series: { date: string; value: number }[];
}

/** Último cierre con fecha <= date. */
export function closeAt(history: Candle[], date: string): Candle | null {
  let lo = 0;
  let hi = history.length - 1;
  let found: Candle | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = history[mid]!;
    if (c.date <= date) {
      found = c;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const daysBetween = (a: string, b: Date) =>
  Math.max(0, Math.round((b.getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000));

export function computePnl(input: {
  quote: CedearQuote;
  quantity: number;
  invested: number;
  date: string | null;
  mep: number | null;
  history: Candle[];
  benchmarkQuote?: CedearQuote | null;
  benchmarkHistory?: Candle[];
  now?: Date;
}): PnlResult {
  const { quote, quantity, invested, date, mep, history } = input;
  const now = input.now ?? new Date();

  const price = quote.last;
  const value = quantity * price;
  const pnl = value - invested;
  const pnlPct = (pnl / invested) * 100;
  const avgCost = invested / quantity;
  const breakEven = avgCost;

  let daysHeld: number | null = null;
  let annualizedPct: number | null = null;
  let closeOnDate: number | null = null;
  let paidVsClosePct: number | null = null;
  let benchmark: PnlResult['benchmark'] = null;

  if (date) {
    daysHeld = daysBetween(date, now);
    if (daysHeld > 30) annualizedPct = (Math.pow(value / invested, 365 / daysHeld) - 1) * 100;
    const c = closeAt(history, date);
    if (c) {
      closeOnDate = c.close;
      paidVsClosePct = ((avgCost - c.close) / c.close) * 100;
    }
    const bq = input.benchmarkQuote;
    const bh = input.benchmarkHistory ?? [];
    const bc = bq ? closeAt(bh, date) : null;
    if (bq && bc && bq.symbol !== quote.symbol) {
      const returnPct = (bq.last / bc.close - 1) * 100;
      benchmark = {
        symbol: bq.symbol,
        returnPct,
        value: invested * (1 + returnPct / 100),
        alphaPct: pnlPct - returnPct,
      };
    }
  }

  // Serie de valorización: desde la compra, o el último año si no hay fecha.
  const from = date ?? new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const series = history.filter((c) => c.date >= from).map((c) => ({ date: c.date, value: c.close * quantity }));

  return {
    symbol: quote.symbol,
    quantity,
    invested,
    avgCost,
    price,
    value,
    liquidationValue: quote.bid > 0 ? quote.bid * quantity : null,
    pnl,
    pnlPct,
    valueUsd: mep ? value / mep : null,
    breakEven,
    toBreakEvenPct: (breakEven / price - 1) * 100,
    date,
    daysHeld,
    annualizedPct,
    closeOnDate,
    paidVsClosePct,
    benchmark,
    series,
  };
}

export interface Holding {
  symbol: string;
  quantity: number;
  invested: number;
  avgCost: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  weightPct: number;
  changePct: number;
  /** Variación de hoy en pesos de esta posición. */
  dayPnl: number;
  entries: number;
}

/** Agrupa posiciones del mismo ticker y las valoriza contra las cotizaciones actuales. */
export function aggregateHoldings(
  entries: { symbol: string; quantity: number; invested: number }[],
  quotes: ReadonlyMap<string, CedearQuote>,
): { holdings: Holding[]; invested: number; value: number; pnl: number; pnlPct: number; dayPnl: number } {
  const groups = new Map<string, { quantity: number; invested: number; entries: number }>();
  for (const e of entries) {
    const g = groups.get(e.symbol) ?? { quantity: 0, invested: 0, entries: 0 };
    g.quantity += e.quantity;
    g.invested += e.invested;
    g.entries += 1;
    groups.set(e.symbol, g);
  }
  const rows: Holding[] = [];
  for (const [symbol, g] of groups) {
    const q = quotes.get(symbol);
    const price = q?.last ?? g.invested / g.quantity;
    const value = price * g.quantity;
    const changePct = q?.changePct ?? 0;
    rows.push({
      symbol,
      quantity: g.quantity,
      invested: g.invested,
      avgCost: g.invested / g.quantity,
      price,
      value,
      pnl: value - g.invested,
      pnlPct: ((value - g.invested) / g.invested) * 100,
      weightPct: 0,
      changePct,
      dayPnl: value - value / (1 + changePct / 100),
      entries: g.entries,
    });
  }
  const invested = rows.reduce((s, r) => s + r.invested, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const dayPnl = rows.reduce((s, r) => s + r.dayPnl, 0);
  for (const r of rows) r.weightPct = value > 0 ? (r.value / value) * 100 : 0;
  rows.sort((a, b) => b.value - a.value);
  return { holdings: rows, invested, value, pnl: value - invested, pnlPct: invested > 0 ? ((value - invested) / invested) * 100 : 0, dayPnl };
}
