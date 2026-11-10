/** Mercados de IOL. Los CEDEARs operan en BCBA (BYMA). */
export const Markets = ['bCBA', 'nYSE', 'nASDAQ', 'aMEX', 'bCS', 'rOFX'] as const;
export type Market = (typeof Markets)[number];

export type InstrumentType = 'CEDEAR' | 'ACCION' | 'BONO' | 'OTRO';

export interface Instrument {
  symbol: string;
  market: Market;
  type: InstrumentType;
}

/** Instrumentos con los que arranca el bot. */
export const DEFAULT_INSTRUMENTS: Instrument[] = [
  { symbol: 'NVDA', market: 'bCBA', type: 'CEDEAR' },
  { symbol: 'AMD', market: 'bCBA', type: 'CEDEAR' },
];
