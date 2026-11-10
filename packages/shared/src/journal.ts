/**
 * Registro de operaciones cerradas y P&L acumulado.
 * Hasta que exista la base (Prisma, paso 4), las operaciones reales viejas
 * viven acá y las simuladas se guardan en el navegador.
 */

export type TradeSource = 'real' | 'simulada';

export interface ClosedTrade {
  id: string;
  symbol: string;
  source: TradeSource;
  /** Cantidad de CEDEARs. */
  quantity: number;
  /** Total pagado al comprar (inversión inicial). */
  invested: number;
  /** Total cobrado al vender. */
  proceeds: number;
  /** Fecha de cierre (YYYY-MM-DD), si se conoce. */
  closedAt?: string;
  /** Días que se mantuvo la posición, si se conoce. */
  holdingDays?: number;
  note?: string;
}

/**
 * Ventas con pérdida informadas por Rodri (capturas de IOL del 10/11/2026).
 * Montos tal como los muestra IOL ("Inversión inicial" y "Mi inversión" al vender).
 */
export const PAST_TRADES: ClosedTrade[] = [
  {
    id: 'real-amd-2026-11',
    symbol: 'AMD',
    source: 'real',
    quantity: 11,
    invested: 883_850,
    proceeds: 768_350,
    closedAt: '2026-11-10',
    note: 'Precio promedio ≈ $80.350; vendido ≈ $69.850 (−14,45 % ese día).',
  },
  {
    id: 'real-nvda-2026-11',
    symbol: 'NVDA',
    source: 'real',
    quantity: 110,
    invested: 1_579_988,
    proceeds: 1_430_000,
    closedAt: '2026-11-10',
    holdingDays: 86,
    note: 'Precio promedio $14.363,53; vendido ≈ $13.000 (−7,40 % ese día).',
  },
  {
    id: 'real-intc-2026-11',
    symbol: 'INTC',
    source: 'real',
    quantity: 12,
    invested: 486_680,
    proceeds: 220_320,
    closedAt: '2026-11-10',
    holdingDays: 144,
    note: 'Precio promedio $40.556,67; vendido ≈ $18.360.',
  },
];

export interface TradeResult extends ClosedTrade {
  pnl: number;
  pnlPct: number;
  /** P&L acumulado hasta esta operación inclusive. */
  cumulativePnl: number;
}

export interface JournalSummary {
  trades: TradeResult[];
  totalInvested: number;
  totalPnl: number;
  wins: number;
  losses: number;
  /** Ganancia promedio de las ganadoras / pérdida promedio de las perdedoras. */
  avgWin: number;
  avgLoss: number;
  /** Peor P&L acumulado alcanzado (≤ 0). */
  worstCumulativePnl: number;
}

export function summarizeJournal(trades: ClosedTrade[]): JournalSummary {
  let cumulative = 0;
  let worst = 0;
  const results: TradeResult[] = trades.map((t) => {
    const pnl = t.proceeds - t.invested;
    cumulative += pnl;
    worst = Math.min(worst, cumulative);
    return { ...t, pnl, pnlPct: t.invested > 0 ? (pnl / t.invested) * 100 : 0, cumulativePnl: cumulative };
  });
  const winners = results.filter((r) => r.pnl > 0);
  const losers = results.filter((r) => r.pnl < 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    trades: results,
    totalInvested: results.reduce((a, r) => a + r.invested, 0),
    totalPnl: cumulative,
    wins: winners.length,
    losses: losers.length,
    avgWin: avg(winners.map((r) => r.pnl)),
    avgLoss: avg(losers.map((r) => r.pnl)),
    worstCumulativePnl: worst,
  };
}

/**
 * Cuántas operaciones ganadoras netas hacen falta para recuperar `loss`,
 * si cada una gana `gainPerWin` (ej. 2 % del capital con R:R 2 y 1 % de riesgo).
 * Ignora las perdedoras que habrá en el medio: es un piso, no una promesa.
 */
export function winsToRecover(loss: number, gainPerWin: number): number {
  if (!(loss > 0) || !(gainPerWin > 0)) return 0;
  return Math.ceil(loss / gainPerWin);
}
