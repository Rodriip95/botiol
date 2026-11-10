import axios, { type AxiosInstance, type AxiosRequestConfig, isAxiosError } from 'axios';
import type { Market, Quote } from '@bot-iol/shared';
import { IolAuthError, IolError } from './errors.js';
import type { IolCotizacion, IolPlazo, IolTokenResponse } from './types.js';

export interface IolClientOptions {
  username: string;
  password: string;
  baseUrl?: string;
  /** Instancia de axios inyectable (para tests). */
  http?: AxiosInstance;
  /** Reloj inyectable (ms epoch), para tests. */
  now?: () => number;
  /** Renovar el token este margen antes de que venza. */
  refreshMarginMs?: number;
  timeoutMs?: number;
}

interface TokenState {
  accessToken: string;
  refreshToken: string;
  /** ms epoch en que vence el access token. */
  expiresAt: number;
  /** ms epoch en que vence el refresh token (si IOL lo informa). */
  refreshExpiresAt: number | null;
}

const DEFAULT_BASE_URL = 'https://api.invertironline.com';

/**
 * Cliente de la API REST de InvertirOnline.
 *
 * Maneja el token bearer: login con usuario/contraseña, renovación con el
 * refresh token antes de que venza, y re-login si el refresh falla.
 * Llamadas concurrentes comparten una sola obtención de token.
 */
export class IolClient {
  private readonly http: AxiosInstance;
  private readonly now: () => number;
  private readonly refreshMarginMs: number;
  private token: TokenState | null = null;
  private pendingToken: Promise<TokenState> | null = null;

  constructor(private readonly opts: IolClientOptions) {
    this.http =
      opts.http ??
      axios.create({
        baseURL: opts.baseUrl ?? DEFAULT_BASE_URL,
        timeout: opts.timeoutMs ?? 15_000,
      });
    this.now = opts.now ?? Date.now;
    this.refreshMarginMs = opts.refreshMarginMs ?? 60_000;
  }

  /** Devuelve un access token válido, logueando o renovando si hace falta. */
  async getAccessToken(): Promise<string> {
    const token = this.token;
    if (token && this.now() < token.expiresAt - this.refreshMarginMs) {
      return token.accessToken;
    }
    return (await this.obtainToken()).accessToken;
  }

  /** Cotización de un título. Para CEDEARs el mercado es bCBA. */
  async getQuote(symbol: string, market: Market = 'bCBA', plazo?: IolPlazo): Promise<Quote> {
    const raw = await this.request<IolCotizacion>({
      method: 'GET',
      url: `/api/v2/${encodeURIComponent(market)}/Titulos/${encodeURIComponent(symbol)}/Cotizacion`,
      params: plazo ? { 'model.plazo': plazo } : undefined,
    });
    return toQuote(symbol, market, raw);
  }

  /** Request autenticado. Si IOL responde 401, renueva el token y reintenta una vez. */
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const accessToken = await this.getAccessToken();
      try {
        const res = await this.http.request<T>({
          ...config,
          headers: { ...config.headers, Authorization: `Bearer ${accessToken}` },
        });
        return res.data;
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 401 && attempt === 0) {
          // El token pudo haber sido revocado: forzamos renovación.
          if (this.token?.accessToken === accessToken) this.token.expiresAt = 0;
          continue;
        }
        throw toIolError(err, `${config.method ?? 'GET'} ${config.url}`);
      }
    }
  }

  private obtainToken(): Promise<TokenState> {
    if (!this.pendingToken) {
      this.pendingToken = this.renewOrLogin().finally(() => {
        this.pendingToken = null;
      });
    }
    return this.pendingToken;
  }

  private async renewOrLogin(): Promise<TokenState> {
    const current = this.token;
    const refreshUsable =
      current !== null &&
      (current.refreshExpiresAt === null || this.now() < current.refreshExpiresAt - this.refreshMarginMs);

    if (current && refreshUsable) {
      try {
        this.token = await this.postToken({
          refresh_token: current.refreshToken,
          grant_type: 'refresh_token',
        });
        return this.token;
      } catch {
        // Refresh rechazado o vencido: volvemos a loguear con usuario y contraseña.
      }
    }

    this.token = await this.postToken({
      username: this.opts.username,
      password: this.opts.password,
      grant_type: 'password',
    });
    return this.token;
  }

  private async postToken(form: Record<string, string>): Promise<TokenState> {
    try {
      const requestedAt = this.now();
      const res = await this.http.post<IolTokenResponse>('/token', new URLSearchParams(form).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = res.data;
      if (!data?.access_token || !data.refresh_token) {
        throw new IolAuthError('Respuesta de /token sin access_token o refresh_token');
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: requestedAt + Number(data.expires_in ?? 0) * 1000,
        refreshExpiresAt: parseDate(data['.refreshexpires']),
      };
    } catch (err) {
      if (err instanceof IolAuthError) throw err;
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const action = form.grant_type === 'refresh_token' ? 'renovar el token' : 'iniciar sesión';
      // Nunca incluir el form en el error: tiene la contraseña.
      throw new IolAuthError(`No se pudo ${action} en IOL${status ? ` (HTTP ${status})` : ''}`, status);
    }
  }
}

function parseDate(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function toIolError(err: unknown, what: string): IolError {
  if (err instanceof IolError) return err;
  if (isAxiosError(err)) {
    const status = err.response?.status;
    return new IolError(`Error en ${what}${status ? ` (HTTP ${status})` : `: ${err.message}`}`, status, err.response?.data);
  }
  return new IolError(`Error en ${what}: ${String(err)}`);
}

export function toQuote(symbol: string, market: Market, raw: IolCotizacion): Quote {
  const best = raw.puntas?.[0];
  return {
    symbol: symbol.toUpperCase(),
    market,
    last: raw.ultimoPrecio,
    changePct: raw.variacion,
    open: raw.apertura,
    high: raw.maximo,
    low: raw.minimo,
    previousClose: raw.cierreAnterior,
    volume: raw.volumenNominal ?? 0,
    currency: raw.moneda ?? 'peso_Argentino',
    bid: best?.precioCompra || null,
    ask: best?.precioVenta || null,
    timestamp: parseIolDateTime(raw.fechaHora),
  };
}

/**
 * IOL devuelve fechas sin zona horaria (hora de Buenos Aires, UTC-3, sin horario de verano).
 */
export function parseIolDateTime(value: string): string {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}-03:00`);
  if (Number.isNaN(date.getTime())) throw new IolError(`Fecha inválida de IOL: ${value}`);
  return date.toISOString();
}
