/**
 * Prueba rápida del cliente IOL: login + cotización.
 *   pnpm quote            -> NVDA en bCBA
 *   pnpm quote AMD
 */
import type { Market } from '@bot-iol/shared';
import { loadConfig } from '../src/config.js';
import { IolClient } from '../src/iol/index.js';

const symbol = (process.argv[2] ?? 'NVDA').toUpperCase();
const market = (process.argv[3] ?? 'bCBA') as Market;

const config = loadConfig();
const iol = new IolClient({ username: config.IOL_USER, password: config.IOL_PASS, baseUrl: config.IOL_BASE_URL });

try {
  const quote = await iol.getQuote(symbol, market);
  console.log(`${quote.symbol} (${quote.market}) — último: ${quote.last} ${quote.currency}, variación: ${quote.changePct}%`);
  console.table(quote);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
