# botiol

Plataforma local para operar CEDEARs (NVDA, AMD) a través de la API de InvertirOnline (IOL): bot con gestión de riesgo y panel web en tiempo real.

> Ningún bot garantiza ganancias. Probar siempre en modo simulación y con montos mínimos. Esto no es asesoramiento financiero.

## Estructura

```
apps/
  server/    Fastify + cliente IOL (después: bot, Prisma, Socket.io)
  web/       React + Vite (panel)
packages/
  shared/    tipos compartidos (Quote, Instrument, Market…)
```

## Requisitos

- Node.js 22 o superior
- pnpm 10 (`corepack enable` lo activa con la versión fijada en `package.json`)
- Cuenta de IOL con el acceso a la API habilitado

## Puesta en marcha

```bash
pnpm install
cp .env.example .env     # completar IOL_USER e IOL_PASS
pnpm quote               # login en IOL + cotización de NVDA (o: pnpm quote AMD)
pnpm dev                 # backend en 127.0.0.1:3001 y panel en http://127.0.0.1:5173
```

El archivo `.env` está en `.gitignore`: las credenciales nunca se suben al repo. El backend solo acepta escuchar en localhost (`HOST` admite `127.0.0.1`, `localhost` o `::1`).

## Scripts

| Comando          | Qué hace                                       |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | Levanta server y web en modo desarrollo        |
| `pnpm quote SYM` | Prueba el cliente IOL con una cotización       |
| `pnpm typecheck` | Chequeo de tipos en todo el monorepo           |
| `pnpm test`      | Tests (vitest) del server                      |
| `pnpm build`     | Typecheck del server y build del panel         |

## API local

- `GET /health`
- `GET /api/quotes/:symbol?market=bCBA` → cotización normalizada (`Quote` de `@bot-iol/shared`)

## Cliente IOL

`apps/server/src/iol/client.ts`:

- Login con usuario y contraseña (`POST /token`, `grant_type=password`).
- Renueva el token con el refresh token un minuto antes de que venza; si el refresh falla, vuelve a loguear.
- Las llamadas concurrentes comparten una sola obtención de token.
- Ante un 401 renueva el token y reintenta una vez.
- `getQuote(symbol, market = 'bCBA')` → `GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion`. IOL devuelve la hora sin zona; se interpreta como hora de Buenos Aires (UTC-3).

## Próximos pasos

1. Prisma + SQLite y guardado de precios cada 5 minutos con node-cron (solo en horario bursátil).
2. Panel con gráfico de velas (Lightweight Charts) alimentado por la base local.
3. Estrategia simple y gestor de riesgo en modo simulación.
