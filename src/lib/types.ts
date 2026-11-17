export type Sector =
  | 'Tecnología'
  | 'Comunicaciones'
  | 'Consumo'
  | 'Finanzas'
  | 'Salud'
  | 'Energía'
  | 'Industria'
  | 'Materiales'
  | 'ETF'
  | 'Latam'
  | 'China'
  | 'Cripto'
  | 'Otros';

/** Cotización normalizada de un CEDEAR en pesos (especie base, plazo 24 hs). */
export interface CedearQuote {
  symbol: string;
  name: string;
  sector: Sector;
  /** Último precio operado en ARS. */
  last: number;
  bid: number;
  ask: number;
  /** Variación diaria en %. */
  changePct: number;
  /** Volumen en nominales. */
  volume: number;
  /** Cantidad de operaciones del día. */
  trades: number;
  /** Precio de la especie en dólares MEP (sufijo D), si cotiza. */
  usdMep: number | null;
}

export interface Candle {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface MarketSnapshot {
  quotes: CedearQuote[];
  /** Dólar MEP implícito promedio de los CEDEARs líquidos. */
  mep: number | null;
  updatedAt: Date;
  source: 'mock' | 'data912';
}

export interface MarketProvider {
  readonly id: MarketSnapshot['source'];
  getSnapshot(): Promise<MarketSnapshot>;
  /** Cierres diarios ascendentes. Vacío si no hay histórico. */
  getHistory(symbol: string): Promise<Candle[]>;
}

/** Una consulta guardada por el usuario. */
export interface SavedEntry {
  id: string;
  symbol: string;
  quantity: number;
  invested: number;
  /** Fecha de compra YYYY-MM-DD, opcional. */
  date: string | null;
  inPortfolio: boolean;
  createdAt: number;
  /** Foto del resultado al momento de guardar. */
  snapshot: { price: number; pnl: number; pnlPct: number };
}

export type NewEntry = Omit<SavedEntry, 'id' | 'createdAt'>;
