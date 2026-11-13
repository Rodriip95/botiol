import { describe, expect, it } from 'vitest';
import { parseAmount, validateCalc } from './validation';
import { aggregateHoldings, closeAt, computePnl } from './pnl';
import { normalizeData912 } from '../data/providers';
import type { CedearQuote } from './types';

const known = new Set(['AAPL', 'SPY']);
const now = new Date('2026-11-13T15:00:00');

describe('parseAmount', () => {
  it.each([
    ['150000', 150000],
    ['150.000', 150000],
    ['150.000,50', 150000.5],
    ['1.234.567,89', 1234567.89],
    ['1,234,567.89', 1234567.89],
    ['1500,5', 1500.5],
    ['$ 2.000', 2000],
  ])('%s → %d', (raw, n) => expect(parseAmount(raw)).toBe(n));

  it.each(['', 'abc', '1.2.3,4,5', '12,34,5', '-500'])('rechaza %j', (raw) => expect(parseAmount(raw)).toBeNull());
});

describe('validateCalc', () => {
  const ok = { symbol: 'aapl', quantity: '10', invested: '200.000', date: '' };

  it('acepta un formulario válido y normaliza', () => {
    const r = validateCalc(ok, known, now);
    expect(r).toEqual({ ok: true, value: { symbol: 'AAPL', quantity: 10, invested: 200000, date: null } });
  });

  it('exige ticker conocido, nominales enteros y monto positivo', () => {
    const r = validateCalc({ symbol: 'ZZZZ', quantity: '1,5', invested: '0', date: '' }, known, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['invested', 'quantity', 'symbol']);
  });

  it('rechaza fechas futuras y anteriores a 2010', () => {
    const fut = validateCalc({ ...ok, date: '2026-11-14' }, known, now);
    const old = validateCalc({ ...ok, date: '2005-01-01' }, known, now);
    expect(!fut.ok && fut.errors.date).toMatch(/futura/);
    expect(!old.ok && old.errors.date).toMatch(/2010/);
  });

  it('acepta la fecha de hoy', () => {
    expect(validateCalc({ ...ok, date: '2026-11-13' }, known, now).ok).toBe(true);
  });
});

const quote = (symbol: string, last: number, changePct = 0): CedearQuote => ({
  symbol,
  name: symbol,
  sector: 'ETF',
  last,
  bid: last - 10,
  ask: last + 10,
  changePct,
  volume: 100,
  trades: 10,
  usdMep: null,
});

describe('computePnl', () => {
  const history = [
    { date: '2025-11-10', close: 15000 },
    { date: '2025-11-12', close: 16000 },
    { date: '2026-11-12', close: 19000 },
  ];
  const spyHist = [
    { date: '2025-11-12', close: 10000 },
    { date: '2026-11-12', close: 12000 },
  ];

  it('calcula ganancia, break even y valor en dólares', () => {
    const r = computePnl({ quote: quote('AAPL', 20000), quantity: 10, invested: 160000, date: null, mep: 1600, history, now });
    expect(r.value).toBe(200000);
    expect(r.pnl).toBe(40000);
    expect(r.pnlPct).toBeCloseTo(25);
    expect(r.breakEven).toBe(16000);
    expect(r.valueUsd).toBeCloseTo(125);
    expect(r.liquidationValue).toBe(199900);
  });

  it('con fecha usa el cierre de la rueda anterior y compara contra el benchmark', () => {
    const r = computePnl({
      quote: quote('AAPL', 20000),
      quantity: 10,
      invested: 160000,
      date: '2025-11-13', // sin rueda ese día: usa 2025-11-12
      mep: null,
      history,
      benchmarkQuote: quote('SPY', 12500),
      benchmarkHistory: spyHist,
      now,
    });
    expect(r.closeOnDate).toBe(16000);
    expect(r.paidVsClosePct).toBeCloseTo(0);
    expect(r.daysHeld).toBe(365);
    expect(r.annualizedPct).toBeCloseTo(25, 0);
    expect(r.benchmark?.returnPct).toBeCloseTo(25);
    expect(r.benchmark?.alphaPct).toBeCloseTo(0);
  });

  it('marca pérdida', () => {
    const r = computePnl({ quote: quote('AAPL', 10000), quantity: 10, invested: 150000, date: null, mep: null, history: [], now });
    expect(r.pnl).toBe(-50000);
    expect(r.toBreakEvenPct).toBeCloseTo(50);
  });
});

describe('closeAt', () => {
  it('devuelve null si la fecha es anterior al histórico', () => {
    expect(closeAt([{ date: '2026-01-02', close: 1 }], '2025-12-31')).toBeNull();
  });
});

describe('aggregateHoldings', () => {
  it('agrupa compras del mismo ticker y calcula pesos', () => {
    const quotes = new Map([
      ['AAPL', quote('AAPL', 100, 10)],
      ['SPY', quote('SPY', 50)],
    ]);
    const r = aggregateHoldings(
      [
        { symbol: 'AAPL', quantity: 10, invested: 800 },
        { symbol: 'AAPL', quantity: 10, invested: 1000 },
        { symbol: 'SPY', quantity: 20, invested: 1000 },
      ],
      quotes,
    );
    expect(r.holdings).toHaveLength(2);
    const aapl = r.holdings.find((h) => h.symbol === 'AAPL')!;
    expect(aapl.quantity).toBe(20);
    expect(aapl.avgCost).toBe(90);
    expect(aapl.weightPct).toBeCloseTo((2000 / 3000) * 100);
    expect(r.pnl).toBe(3000 - 2800);
  });
});

describe('normalizeData912', () => {
  it('descarta las especies en dólares y usa la D como precio MEP', () => {
    const row = (symbol: string, c: number) => ({ symbol, px_bid: c, px_ask: c, c, v: 1, q_op: 1, pct_change: 0 });
    const r = normalizeData912([row('AAPL', 29920), row('AAPLD', 19), row('AAPLC', 18), row('C', 68750), row('DD', 9000)]);
    expect(r.map((q) => q.symbol).sort()).toEqual(['AAPL', 'C', 'DD']);
    expect(r.find((q) => q.symbol === 'AAPL')?.usdMep).toBe(19);
    expect(r.find((q) => q.symbol === 'AAPL')?.name).toBe('Apple');
  });
});
