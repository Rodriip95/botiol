import { describe, expect, it } from 'vitest';
import type { Quote } from '@bot-iol/shared';
import { IolAuthError, type IolClient } from '../src/iol/index.js';
import { buildServer } from '../src/server.js';

const quote: Quote = {
  symbol: 'NVDA', market: 'bCBA', last: 100, changePct: 1, open: 99, high: 101, low: 98,
  previousClose: 99, volume: 10, currency: 'peso_Argentino', bid: 99.5, ask: 100.5,
  timestamp: '2026-11-10T19:00:00.000Z',
};

const fakeIol = (impl: IolClient['getQuote']) => ({ getQuote: impl }) as unknown as IolClient;

describe('server', () => {
  it('GET /health', async () => {
    const app = buildServer({ iol: fakeIol(async () => quote), logger: false });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('GET /api/quotes/:symbol devuelve la cotización', async () => {
    const app = buildServer({ iol: fakeIol(async (s, m) => ({ ...quote, symbol: s, market: m ?? 'bCBA' })), logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/quotes/nvda' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ symbol: 'NVDA', market: 'bCBA', last: 100 });
  });

  it('valida símbolo y mercado', async () => {
    const app = buildServer({ iol: fakeIol(async () => quote), logger: false });
    expect((await app.inject({ method: 'GET', url: '/api/quotes/NV$DA' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/quotes/NVDA?market=xx' })).statusCode).toBe(400);
  });

  it('responde 502 si falla la autenticación con IOL', async () => {
    const app = buildServer({
      iol: fakeIol(async () => {
        throw new IolAuthError('No se pudo iniciar sesión en IOL (HTTP 400)', 400);
      }),
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/api/quotes/NVDA' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('iol_auth');
  });
});

describe('GET /api/atr/:symbol', () => {
  const candles = Array.from({ length: 20 }, (_, i) => ({
    time: `2026-10-${String(i + 1).padStart(2, '0')}T20:00:00.000Z`,
    open: 100, high: 102, low: 98, close: 100,
  }));
  const iolWith = (getDailyCandles: IolClient['getDailyCandles']) =>
    ({ getQuote: async () => quote, getDailyCandles }) as unknown as IolClient;

  it('calcula el ATR con velas diarias', async () => {
    const app = buildServer({ iol: iolWith(async () => candles), logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/atr/nvda' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ symbol: 'NVDA', period: 14, atr: 4, candles: 20, lastClose: 100 });
  });

  it('422 si no hay velas suficientes', async () => {
    const app = buildServer({ iol: iolWith(async () => candles.slice(0, 5)), logger: false });
    expect((await app.inject({ method: 'GET', url: '/api/atr/NVDA' })).statusCode).toBe(422);
  });
});
