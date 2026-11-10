---
name: mercado-argentino-cedears
description: Usar al trabajar con horarios de BYMA, plazos de liquidación, feriados, ratios de CEDEARs, el efecto del CCL/MEP en el precio, liquidez y spread, o al programar el cron del bot para que opere solo en horario bursátil.
---

# Mercado argentino y CEDEARs

Los datos de esta skill cambian con el tiempo (horarios, ratios, feriados). Cuando algo dependa de un valor exacto, **verificarlo en la fuente** (BYMA, Caja de Valores, Comafi, IOL) y guardarlo en configuración, no en el código.

## Horario de BYMA

- Rueda de negociación de acciones y CEDEARs: **11:00 a 17:00, hora de Buenos Aires** (UTC−3, sin horario de verano). Verificar en byma.com.ar si cambió.
- Usar siempre la zona `America/Argentina/Buenos_Aires` para decidir si el mercado está abierto; el servidor puede estar en otra zona.
- Evitar operar los primeros y últimos 15–30 minutos: spreads anchos y precios poco representativos.
- node-cron: `cron.schedule('*/5 11-16 * * 1-5', fn, { timezone: 'America/Argentina/Buenos_Aires' })` y además chequear feriados dentro de `fn`.

## Plazos de liquidación

- Desde 2024 el plazo estándar es **T+1 ("24 hs")**; también existe **contado inmediato (CI, T+0)**. En la API de IOL el plazo se indica como `t0` / `t1` (ver `api-iol`).
- El precio puede diferir entre plazos. Usar siempre el mismo plazo para cotizar, simular y operar (por defecto T+1, que suele ser el más líquido).
- Con T+1, el efectivo de una venta no está disponible hasta el día hábil siguiente: el gestor de riesgo debe usar el **disponible para operar** que informa IOL, no el saldo total.

## Feriados

- BYMA no opera en feriados nacionales argentinos, incluidos los trasladables, ni en los días no laborables con fines turísticos que el mercado adhiera. Mantener un calendario anual en configuración (`holidays/AAAA.json`) y actualizarlo cada diciembre con el calendario oficial y el de BYMA.
- **Feriados de EE. UU.**: BYMA abre pero el subyacente no cotiza. El CEDEAR solo se mueve por el dólar CCL y la liquidez cae. Regla del proyecto: no abrir posiciones nuevas esos días.
- Días con horario reducido en EE. UU. (ej. día después de Thanksgiving): tratar igual que feriado o con precaución.

## Ratio de cada CEDEAR

- Un CEDEAR representa una fracción de la acción subyacente: `ratio = CEDEARs por 1 acción` (ej. "10:1").
- Los ratios **cambian** cuando el subyacente hace un split o cuando el emisor los ajusta. Consultar el listado vigente del emisor (Banco Comafi / Caja de Valores) y guardarlo en `Instrument` con fecha de vigencia.
- Al hacer backtesting con históricos, ajustar los precios anteriores a un cambio de ratio; si no, aparece un "salto" falso.

## CCL / MEP y el precio

Precio teórico del CEDEAR en pesos:

```
precio_cedear_ars ≈ precio_subyacente_usd × CCL / ratio
CCL_implícito     = precio_cedear_ars × ratio / precio_subyacente_usd
```

- El precio en pesos se mueve por **dos factores**: la acción en EE. UU. y el dólar CCL. Una suba del CEDEAR puede ser solo devaluación.
- Para analizar la acción en sí, convertir a dólares (`precio_ars / CCL`) o usar el CEDEAR en dólares (especie con sufijo `D` para MEP o `C` para cable, si es líquida).
- Si el CCL implícito de un CEDEAR se aleja mucho del promedio de otros CEDEARs líquidos, el precio está desalineado (oportunidad o falta de liquidez).
- Reportar P&L tanto en pesos como en dólares; una ganancia en pesos puede ser pérdida en dólares.

## Liquidez y spread

- Mirar siempre las **puntas** (mejor compra y venta) antes de operar. `spread_% = (venta − compra) / punto_medio`.
- NVDA y AMD suelen estar entre los CEDEARs más líquidos, pero el spread igual puede ser mayor al de EE. UU.; con spread > 0,5 % no operar.
- Preferir órdenes **límite** (al precio de la punta o mejor) antes que a mercado.
- No enviar órdenes por más de una fracción del volumen visible en la punta.
- En simulación, ejecutar compras a la punta vendedora y ventas a la compradora, no al último precio.
