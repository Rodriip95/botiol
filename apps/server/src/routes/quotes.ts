import type { FastifyPluginAsync } from 'fastify';
import { Markets, type ApiError, type Market, type Quote } from '@bot-iol/shared';
import { IolAuthError, IolError, type IolClient } from '../iol/index.js';

const SYMBOL_RE = /^[A-Z0-9.]{1,12}$/;

export const quoteRoutes: FastifyPluginAsync<{ iol: IolClient }> = async (app, { iol }) => {
  app.get<{ Params: { symbol: string }; Querystring: { market?: string }; Reply: Quote | ApiError }>(
    '/quotes/:symbol',
    async (req, reply) => {
      const symbol = req.params.symbol.toUpperCase();
      const market = (req.query.market ?? 'bCBA') as Market;

      if (!SYMBOL_RE.test(symbol)) {
        return reply.code(400).send({ error: 'bad_request', message: 'Símbolo inválido' });
      }
      if (!Markets.includes(market)) {
        return reply.code(400).send({ error: 'bad_request', message: `Mercado inválido: ${market}` });
      }

      try {
        return await iol.getQuote(symbol, market);
      } catch (err) {
        req.log.error({ err }, 'Error consultando cotización en IOL');
        if (err instanceof IolAuthError) {
          return reply.code(502).send({ error: 'iol_auth', message: err.message });
        }
        if (err instanceof IolError) {
          const code = err.status === 404 ? 404 : 502;
          return reply.code(code).send({ error: 'iol_error', message: err.message });
        }
        throw err;
      }
    },
  );
};
