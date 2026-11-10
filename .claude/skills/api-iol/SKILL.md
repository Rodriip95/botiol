---
name: api-iol
description: Usar al trabajar con la API REST de InvertirOnline (apps/server/src/iol): autenticación, endpoints de cotizaciones, portafolio, estado de cuenta y órdenes, tipos de orden, límites de uso, y cálculo de comisiones y derechos de mercado.
---

# API de IOL

Documentación oficial: https://api.invertironline.com (Swagger en `/swagger`). Ante cualquier duda sobre nombres de campos, **consultar el Swagger** y ajustar `apps/server/src/iol/types.ts`; los nombres de esta skill pueden quedar desactualizados.

El cliente ya implementado (`IolClient`) maneja el token. Todo endpoint nuevo se agrega como método del cliente usando `this.request()`, con tipos crudos en `types.ts` y normalización a tipos de `@bot-iol/shared`.

## Autenticación

- `POST /token` con `application/x-www-form-urlencoded`:
  - Login: `username`, `password`, `grant_type=password`.
  - Renovación: `refresh_token`, `grant_type=refresh_token`.
- Respuesta: `access_token`, `refresh_token`, `expires_in` (segundos, del orden de 15 min), `.expires`, `.refreshexpires`.
- Header en cada request: `Authorization: Bearer <access_token>`.
- La API debe estar habilitada en la cuenta de IOL. Nunca loguear el token ni la contraseña.

## Endpoints principales (v2)

| Uso | Método y ruta |
| --- | --- |
| Cotización | `GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion` |
| Cotización con puntas | `GET /api/v2/{mercado}/Titulos/{simbolo}/CotizacionDetalle` |
| Serie histórica | `GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion/seriehistorica/{desde}/{hasta}/{ajustada}` (`ajustada` = `ajustada` o `sinAjustar`) |
| Panel de cotizaciones | `GET /api/v2/Cotizaciones/{instrumento}/{panel}/{pais}` (ej. `cedears/todos/argentina`) |
| Estado de cuenta | `GET /api/v2/estadocuenta` |
| Portafolio | `GET /api/v2/portafolio/argentina` |
| Comprar | `POST /api/v2/operar/Comprar` |
| Vender | `POST /api/v2/operar/Vender` |
| Listar operaciones | `GET /api/v2/operaciones` (filtros por estado y fecha) |
| Detalle de operación | `GET /api/v2/operaciones/{numero}` |
| Cancelar | `DELETE /api/v2/operaciones/{numero}` |

Mercado para CEDEARs: `bCBA`. Plazo: `t0` (contado inmediato) o `t1` (24 hs).

## Órdenes

Cuerpo típico de `Comprar` / `Vender` (verificar en Swagger):

```json
{ "mercado": "bCBA", "simbolo": "NVDA", "cantidad": 10, "precio": 15200,
  "plazo": "t1", "validez": "2026-11-10T17:00:00", "tipoOrden": "precioLimite" }
```

- `tipoOrden`: `precioLimite` (usar siempre) o `precioMercado`.
- La respuesta trae un **número de operación**: guardarlo en `Order.iolId` y consultar su estado hasta que quede terminada, parcial o cancelada.
- **IOL no tiene stop loss ni take profit nativos en la API**: el bot los gestiona monitoreando el precio y enviando la orden de salida. Por eso el bot debe estar corriendo mientras haya posiciones abiertas.
- Las órdenes límite vencen al final de la validez; al cierre, conciliar órdenes pendientes y portafolio.
- Modo simulación: **el bot nunca llama a `operar/*` si el modo es simulación**. Ese chequeo va en un solo lugar del cliente.

## Límites de uso

- IOL no publica un límite fijo; tratar la API como escasa: **no más de ~1 request por segundo** sostenido, y cotizar cada 1–5 min por instrumento, no en bucle.
- Ante `429` o `5xx`: backoff exponencial (1 s, 2 s, 4 s…, máx. 5 intentos) y registrar el evento.
- Cachear la cotización unos segundos si varias partes del sistema la piden a la vez.
- Para backtesting, descargar la serie histórica una vez y guardarla en SQLite.

## Comisiones y derechos de mercado

El costo de cada operación (compra y venta por separado) es aproximadamente:

```
comisión_broker   = monto × tasa_comisión_IOL           (según el plan de la cuenta)
derechos_mercado  = monto × tasa_derechos_BYMA
iva               = (comisión_broker + derechos_mercado) × 0,21
costo_total       = comisión_broker + derechos_mercado + iva
```

- Las tasas dependen del plan de IOL y cambian: tomarlas del **tarifario vigente de IOL** y guardarlas en `.env` o configuración (`IOL_COMISION_PCT`, `BYMA_DERECHOS_PCT`), no en el código.
- El costo de ida y vuelta suele rondar el 1 % o más del monto en planes básicos: una estrategia que busca movimientos de 1 % no es rentable.
- Si IOL devuelve el costo real en el detalle de la operación, usar ese valor en `Order` y `Trade` en lugar del estimado.
- Toda métrica (P&L, acierto, expectativa) se calcula **neta** de estos costos.
