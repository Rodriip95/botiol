import Fastify, { type FastifyInstance } from 'fastify';
import type { IolClient } from './iol/index.js';
import { atrRoutes } from './routes/atr.js';
import { quoteRoutes } from './routes/quotes.js';

export interface AppDeps {
  iol: IolClient;
  logger?: boolean;
}

export function buildServer({ iol, logger = true }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: logger
      ? {
          level: 'info',
          // Por las dudas: nunca loguear credenciales ni tokens.
          redact: ['req.headers.authorization', '*.password', '*.IOL_PASS'],
        }
      : false,
  });

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));
  app.register(quoteRoutes, { prefix: '/api', iol });
  app.register(atrRoutes, { prefix: '/api', iol });

  return app;
}
