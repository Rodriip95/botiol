import { loadConfig } from './config.js';
import { IolClient } from './iol/index.js';
import { buildServer } from './server.js';

const config = loadConfig();
const iol = new IolClient({
  username: config.IOL_USER,
  password: config.IOL_PASS,
  baseUrl: config.IOL_BASE_URL,
});

const app = buildServer({ iol });

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} recibido, cerrando servidor`);
    void app.close().then(() => process.exit(0));
  });
}
