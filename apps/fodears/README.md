# FODEARS

**portFOlio de ceDEARS.** Es una microapp para saber si los CEDEARs que compraste te dan ganancia o pérdida, y cómo te fue contra el mercado.

- **Calculadora** (sin login): elegís el CEDEAR, cargás los nominales, el total que pagaste y, si querés, la fecha de compra. Te muestra:
  - ganancia o pérdida en pesos y en %;
  - valor actual, valor en dólares MEP, break even y precio de venta a la punta compradora;
  - con fecha: rendimiento anualizado, el cierre de ese día y la comparación contra el SPY.
- **Mercado**: buscador de todos los CEDEARs, con filtro por categoría, orden y variación promedio por sector.
- **Portfolio** (con login): agrupa tus compras, muestra el valor total, el resultado, la variación del día, la evolución de los últimos 6 meses, la distribución por categoría y la comparación contra el SPY.
- **Historial** (con login): tus consultas guardadas, valorizadas al precio de hoy. Desde ahí las movés al portfolio, las recalculás o las borrás.

Todo funciona con **mocks** por defecto: no hace falta configurar nada para verlo andando.

## Correr en local

Desde la raíz del monorepo:

```bash
pnpm install
pnpm dev:fodears          # http://127.0.0.1:5174
```

Otros comandos (desde `apps/fodears` o con `pnpm --filter @bot-iol/fodears <cmd>`):

| Comando          | Qué hace                                  |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo en el puerto 5174  |
| `pnpm build`     | Typecheck y build de producción a `dist/` |
| `pnpm preview`   | Sirve el build en el puerto 4174          |
| `pnpm test`      | Tests de validación y cálculo (vitest)    |

## Variables de entorno

Copiá `apps/fodears/.env.example` a `apps/fodears/.env.local` y completá las variables. El `.gitignore` de la raíz ya ignora `.env.*`.

> Todo lo que empieza con `VITE_` termina **dentro del bundle** que se descarga el navegador. Ahí no van secretos. La config web de Firebase no es secreta: la seguridad la dan las reglas de Firestore y los dominios autorizados.

| Variable                            | Necesaria para        | Valor                                            |
| ----------------------------------- | --------------------- | ------------------------------------------------ |
| `VITE_DATA_PROVIDER`                | Cotizaciones reales   | `mock` (por defecto) o `data912`                 |
| `VITE_FIREBASE_API_KEY`             | Login y guardado      | Firebase Console → Configuración → App web       |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Login y guardado      | `tu-proyecto.firebaseapp.com`                    |
| `VITE_FIREBASE_PROJECT_ID`          | Login y guardado      | `tu-proyecto`                                    |
| `VITE_FIREBASE_STORAGE_BUCKET`      | (opcional)            | `tu-proyecto.firebasestorage.app`                |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | (opcional)            | número del proyecto                              |
| `VITE_FIREBASE_APP_ID`              | Login y guardado      | `1:…:web:…`                                      |

Si falta alguna de las variables de Firebase marcadas como necesarias, la app entra en **modo demo**: "Continuar con Google" crea un usuario de ejemplo y todo se guarda en el `localStorage` del navegador, con un portfolio de muestra precargado.

## Lo que tenés que gestionar vos

### 1. Firebase (login con Google y guardado)

1. Creá un proyecto en <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** habilitá **Google** y elegí un email de soporte.
3. **Authentication → Settings → Authorized domains:** agregá `localhost` (suele venir por defecto) y el dominio donde publiques la app (ej. `fodears.web.app` o tu dominio propio).
4. **Firestore Database →** crear base en **modo producción** (la región `southamerica-east1` es la más cercana a Argentina).
5. **Reglas:** copiá el contenido de [`firestore.rules`](firestore.rules) en Firestore → Reglas y publicalas, o usá la CLI:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules --project tu-proyecto
   ```
   Las reglas permiten que cada usuario lea y escriba solo `users/{uid}/entries`, validan los campos y, al actualizar, solo dejan cambiar `inPortfolio`.
6. **Configuración del proyecto → Tus apps → Agregar app web:** copiá los valores del objeto `firebaseConfig` a las variables `VITE_FIREBASE_*`.
7. No hace falta crear índices: la consulta es `orderBy('createdAt')` dentro de la subcolección del usuario.

Modelo de datos en Firestore:

```
users/{uid}/entries/{id}
  symbol: "MELI"
  quantity: 60
  invested: 1050000
  date: "2025-09-03" | null
  inPortfolio: true
  createdAt: 1763000000000
  snapshot: { price, pnl, pnlPct }   // foto del resultado al guardar
```

### 2. Cotizaciones: data912 (gratis, sin credenciales)

Con `VITE_DATA_PROVIDER=data912` la app consulta <https://data912.com> directo desde el navegador. La API tiene CORS habilitado y no pide key. Endpoints que usa:

| Endpoint                            | Uso                                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| `GET /live/arg_cedears`             | Panel de CEDEARs: último, puntas, volumen y variación      |
| `GET /live/mep`                     | Dólar MEP implícito (se usa la mediana)                    |
| `GET /historical/cedears/{ticker}`  | Cierres diarios: gráfico, cierre del día de compra y SPY   |

Lo probé el 13/11/2026 desde el navegador: devolvió 424 CEDEARs (sin contar las especies en dólares), el MEP y el histórico de MELI desde 2018.

Hay que tener en cuenta:

- Es un proyecto comunitario, **sin SLA ni términos de uso publicados**. Los datos vienen **demorados** (cache de ~30 s en el panel en vivo) y puede caerse o cambiar de formato.
- Para un producto público con tráfico, conviene un proxy propio con cache o un proveedor con contrato. BYMA no permite redistribuir su información sin autorización: <marketdata@byma.com.ar>.
- data912 no informa el **nombre ni la categoría** del CEDEAR. Salen de [`src/data/catalog.ts`](src/data/catalog.ts), que tiene los ~80 más operados. El resto aparece como "Otros". Para sumar más, agregalos a esa tabla.

### 3. IOL (opcional, tiempo real)

La API de InvertirOnline da cotizaciones en tiempo real (`GET /api/v2/Cotizaciones/cedears/todos/argentina`), pero **pide usuario y contraseña de una cuenta de IOL**. Esas credenciales nunca pueden ir en el navegador, así que IOL solo se puede usar a través de un backend.

Este monorepo ya tiene uno (`apps/server`, con el cliente IOL y renovación de token). Para conectarlo:

1. En el `.env` de la raíz: `IOL_USER`, `IOL_PASS` e `IOL_BASE_URL=https://api.invertironline.com`. La cuenta tiene que tener la API habilitada.
2. Agregar en el server una ruta `GET /api/cedears` que llame al panel de IOL y devuelva el formato `CedearQuote[]` de `src/lib/types.ts`.
3. Agregar un `iolProvider` en `src/data/providers.ts` que consuma esa ruta, y la opción `iol` en `VITE_DATA_PROVIDER`.
4. Publicar ese backend en un hosting propio (Cloud Run, Railway, Fly) y proteger la ruta, por ejemplo verificando el ID token de Firebase con `firebase-admin`.

Esto **no está implementado todavía**: con data912 alcanza para la microapp.

## Publicar

Es un sitio estático (`dist/`). Cualquiera de estas opciones sirve:

- **Firebase Hosting:** `firebase init hosting` (public dir `apps/fodears/dist`, SPA: sí) y después `pnpm --filter @bot-iol/fodears build && firebase deploy --only hosting`.
- **Vercel o Netlify:** root `apps/fodears`, build `pnpm build`, output `dist`. Cargá las variables `VITE_*` en el panel.

Después de publicar, agregá el dominio en **Authorized domains** de Firebase Auth.

## Estructura

```
src/
  App.tsx                 ruteo por hash (#/calc, #/mercado, #/portfolio, #/historial)
  auth/                   Firebase (carga diferida) y AuthContext con fallback demo
  data/
    catalog.ts            nombres, categorías y precios semilla del mock
    providers.ts          mock y data912, con cache (30 s panel, histórico por sesión)
    entries.ts            consultas guardadas: Firestore o localStorage
    hooks.ts              useMarket, useHistory, useEntries
  lib/
    validation.ts         validación del formulario (montos es-AR, fechas, enteros)
    pnl.ts                cálculo de resultado, anualizado, benchmark y agregado de portfolio
    format.ts             formato de moneda y porcentajes es-AR
  components/             Shell, CedearPicker, gráficos SVG propios, KPI cards
  views/                  Calculadora, Mercado, Portfolio, Historial
firestore.rules           reglas de seguridad de Firestore
```

## Limitaciones conocidas

- Los resultados **no descuentan comisiones, derechos de mercado ni impuestos**.
- El P&L se calcula en pesos. El valor en dólares usa el MEP de hoy. No hay MEP histórico, así que no se calcula el resultado en dólares desde la compra.
- Si en algún momento cambió el ratio del CEDEAR, el histórico de data912 parece venir ajustado, pero conviene verificarlo con un caso real antes de confiar en el "cierre del día de compra".
- La calculadora avisa (sin bloquear) si el precio que pagaste por nominal difiere más de un 25 % del cierre de ese día.
- No es asesoramiento financiero.
