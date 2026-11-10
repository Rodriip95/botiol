import type { FastifyPluginAsync } from 'fastify';
import { atr, type ApiError, type AtrResponse } from '@bot-iol/shared';
import { IolAuthError, IolError, type IolClient } from '../iol/index.js';

const SYMBOL_RE = /^[A-Z0-9.]{1,12}$/;
/** Días corridos hacia atrás: alcanza para ~14 ruedas + feriados de sobra. */
const LOOKBACK_DAYS = 60;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const atrRoutes: FastifyPluginAsync<{ iol: IolClient; now?: () => Date }> = async (app, { iol, now = () => new Date() }) => {
  app.get<{ Params: { symbol: string }; Querystring: { period?: string }; Reply: AtrResponse | ApiError }>(
    '/atr/:symbol',
    async (req, reply) => {
      const symbol = req.params.symbol.toUpperCase();
      const period = Number(req.query.period ?? 14);
      if (!SYMBOL_RE.test(symbol)) {
        return reply.code(400).send({ error: 'bad_request', message: 'Símbolo inválido' });
      }
      if (!Number.isInteger(period) || period < 2 || period > 50) {
        return reply.code(400).send({ error: 'bad_request', message: 'Período inválido (2 a 50)' });
      }

      const to = now();
      const from = new Date(to.getTime() - LOOKBACK_DAYS * 86_400_000);
      try {
        const candles = await iol.getDailyCandles(symbol, ymd(from), ymd(to));
        const value = atr(candles, period);
        if (value === null) {
          return reply
            .code(422)
            .send({ error: 'not_enough_data', message: `IOL devolvió ${candles.length} velas, hacen falta ${period + 1}` });
        }
        const last = candles[candles.length - 1]!;
        return { symbol, period, atr: value, candles: candles.length, lastClose: last.close, lastDate: last.time };
      } catch (err) {
        req.log.error({ err }, 'Error consultando la serie histórica en IOL');
        if (err instanceof IolAuthError) return reply.code(502).send({ error: 'iol_auth', message: err.message });
        if (err instanceof IolError) return reply.code(502).send({ error: 'iol_error', message: err.message });
        throw err;
      }
    },
  );
};
