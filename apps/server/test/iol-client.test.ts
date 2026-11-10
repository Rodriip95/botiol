import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { IolAuthError, IolClient, parseIolDateTime } from '../src/iol/index.js';
import type { IolCotizacion } from '../src/iol/index.js';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data: unknown };

/** Fake de la API de IOL: registra cada request y responde según el handler. */
function fakeIol(handler: Handler) {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    await Promise.resolve();
    const { status, data } = handler(config);
    const response = { status, data, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`HTTP ${status}`, String(status), config, null, response);
    }
    return response;
  };
  return { http: axios.create({ baseURL: 'https://iol.test', adapter }), calls };
}

const form = (config: InternalAxiosRequestConfig) => new URLSearchParams(String(config.data));

const tokenResponse = (n: number, expiresIn = 900) => ({
  status: 200,
  data: {
    access_token: `access-${n}`,
    token_type: 'bearer',
    expires_in: expiresIn,
    refresh_token: `refresh-${n}`,
    '.refreshexpires': new Date(Date.UTC(2030, 0, 1)).toUTCString(),
  },
});

const cotizacion: IolCotizacion = {
  ultimoPrecio: 15230.5,
  variacion: 1.25,
  apertura: 15000,
  maximo: 15400,
  minimo: 14950,
  fechaHora: '2026-11-10T16:59:58.123',
  cierreAnterior: 15042.5,
  volumenNominal: 123456,
  moneda: 'peso_Argentino',
  puntas: [{ cantidadCompra: 10, precioCompra: 15220, precioVenta: 15240, cantidadVenta: 5 }],
};

function setup(handler: Handler) {
  let now = Date.UTC(2026, 10, 10, 15, 0, 0);
  const fake = fakeIol(handler);
  const client = new IolClient({ username: 'user', password: 'secret', http: fake.http, now: () => now });
  return { client, calls: fake.calls, advance: (ms: number) => (now += ms) };
}

describe('IolClient', () => {
  it('hace login con usuario y contraseña y reutiliza el token', async () => {
    let logins = 0;
    const { client, calls } = setup((c) => {
      if (c.url === '/token') return tokenResponse(++logins);
      return { status: 200, data: cotizacion };
    });

    await client.getQuote('NVDA');
    await client.getQuote('AMD');

    const tokenCalls = calls.filter((c) => c.url === '/token');
    expect(tokenCalls).toHaveLength(1);
    const body = form(tokenCalls[0]!);
    expect(body.get('grant_type')).toBe('password');
    expect(body.get('username')).toBe('user');
    expect(body.get('password')).toBe('secret');
    expect(calls[1]!.headers.Authorization).toBe('Bearer access-1');
    expect(calls[1]!.url).toBe('/api/v2/bCBA/Titulos/NVDA/Cotizacion');
  });

  it('comparte un único login entre llamadas concurrentes', async () => {
    let logins = 0;
    const { client, calls } = setup((c) => (c.url === '/token' ? tokenResponse(++logins) : { status: 200, data: cotizacion }));

    await Promise.all([client.getQuote('NVDA'), client.getQuote('AMD'), client.getAccessToken()]);

    expect(calls.filter((c) => c.url === '/token')).toHaveLength(1);
  });

  it('renueva con el refresh token antes de que venza el access token', async () => {
    let n = 0;
    const { client, calls, advance } = setup((c) => (c.url === '/token' ? tokenResponse(++n) : { status: 200, data: cotizacion }));

    expect(await client.getAccessToken()).toBe('access-1');
    advance(14.5 * 60_000); // quedan 30 s, dentro del margen de 60 s
    expect(await client.getAccessToken()).toBe('access-2');

    const refresh = form(calls[1]!);
    expect(refresh.get('grant_type')).toBe('refresh_token');
    expect(refresh.get('refresh_token')).toBe('refresh-1');
    expect(refresh.has('password')).toBe(false);
  });

  it('vuelve a loguear si el refresh es rechazado', async () => {
    let n = 0;
    const { client, calls, advance } = setup((c) => {
      if (c.url !== '/token') return { status: 200, data: cotizacion };
      if (form(c).get('grant_type') === 'refresh_token') return { status: 400, data: { error: 'invalid_grant' } };
      return tokenResponse(++n);
    });

    await client.getAccessToken();
    advance(16 * 60_000);
    expect(await client.getAccessToken()).toBe('access-2');
    expect(calls.map((c) => form(c).get('grant_type'))).toEqual(['password', 'refresh_token', 'password']);
  });

  it('ante un 401 renueva el token y reintenta una vez', async () => {
    let n = 0;
    const { client, calls } = setup((c) => {
      if (c.url === '/token') return tokenResponse(++n);
      return c.headers.Authorization === 'Bearer access-1' ? { status: 401, data: {} } : { status: 200, data: cotizacion };
    });

    const quote = await client.getQuote('NVDA');
    expect(quote.last).toBe(15230.5);
    expect(calls.map((c) => c.url)).toEqual([
      '/token',
      '/api/v2/bCBA/Titulos/NVDA/Cotizacion',
      '/token',
      '/api/v2/bCBA/Titulos/NVDA/Cotizacion',
    ]);
  });

  it('lanza IolAuthError sin exponer la contraseña si el login falla', async () => {
    const { client } = setup(() => ({ status: 400, data: { error: 'invalid_grant' } }));

    const err = await client.getQuote('NVDA').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IolAuthError);
    expect((err as IolAuthError).status).toBe(400);
    expect(String((err as Error).message)).not.toContain('secret');
  });

  it('normaliza la cotización de IOL', async () => {
    const { client } = setup((c) => (c.url === '/token' ? tokenResponse(1) : { status: 200, data: cotizacion }));

    expect(await client.getQuote('nvda')).toEqual({
      symbol: 'NVDA',
      market: 'bCBA',
      last: 15230.5,
      changePct: 1.25,
      open: 15000,
      high: 15400,
      low: 14950,
      previousClose: 15042.5,
      volume: 123456,
      currency: 'peso_Argentino',
      bid: 15220,
      ask: 15240,
      timestamp: '2026-11-10T19:59:58.123Z',
    });
  });
});

describe('parseIolDateTime', () => {
  it('interpreta fechas sin zona como hora de Buenos Aires', () => {
    expect(parseIolDateTime('2026-11-10T11:00:00')).toBe('2026-11-10T14:00:00.000Z');
  });
  it('respeta la zona si viene informada', () => {
    expect(parseIolDateTime('2026-11-10T11:00:00Z')).toBe('2026-11-10T11:00:00.000Z');
  });
});

describe('toDailyCandles', () => {
  it('una vela por día, ordenada y sin registros vacíos', async () => {
    const { toDailyCandles } = await import('../src/iol/index.js');
    const row = (fechaHora: string, ultimoPrecio: number) => ({ ...cotizacion, fechaHora, ultimoPrecio });
    const out = toDailyCandles([
      row('2026-11-07T16:59:00', 15100),
      row('2026-11-06T16:59:00', 15000),
      row('2026-11-07T12:00:00', 14900),
      { ...row('2026-11-05T16:59:00', 0), maximo: 0, minimo: 0 },
    ]);
    expect(out.map((c) => c.close)).toEqual([15000, 15100]);
  });
});
