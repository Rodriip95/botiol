import type { Market } from './market.js';

/** Cotización normalizada, independiente del formato crudo de IOL. */
export interface Quote {
  symbol: string;
  market: Market;
  /** Último precio operado. */
  last: number;
  /** Variación porcentual del día. */
  changePct: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  /** Volumen nominal operado. */
  volume: number;
  currency: string;
  /** Mejor punta compradora / vendedora, si hay. */
  bid: number | null;
  ask: number | null;
  /** Fecha y hora de la cotización (ISO 8601). */
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
}

/** Respuesta de GET /api/atr/:symbol (velas diarias). */
export interface AtrResponse {
  symbol: string;
  period: number;
  atr: number;
  /** Cantidad de velas diarias usadas. */
  candles: number;
  lastClose: number;
  /** Fecha de la última vela (ISO 8601). */
  lastDate: string;
}
