---
name: analisis-tecnico
description: Usar al diseñar, implementar o revisar señales del motor de estrategia (medias móviles, RSI, MACD, ATR, volumen), al decidir si una señal es débil, al detectar mercado lateral vs. tendencia, o al ajustar parámetros sin sobreajustar.
---

# Análisis técnico para el motor de estrategia

El motor recibe velas, calcula indicadores con `technicalindicators` y devuelve `comprar | vender | mantener` con un **motivo** legible que se guarda en `Signal`. Toda señal se calcula sobre **velas cerradas**: nunca usar la vela en formación.

## Indicadores y cómo leerlos

| Indicador | Parámetros típicos | Lectura | Trampa común |
| --- | --- | --- | --- |
| SMA / EMA | rápida 9–20, lenta 50–200 | Cruce de la rápida sobre la lenta = posible inicio de tendencia alcista; pendiente de la lenta = dirección de fondo | Llega tarde y en lateral da cruces falsos uno tras otro |
| RSI | 14 | >70 sobrecompra, <30 sobreventa **en lateral**; en tendencia fuerte puede quedarse >70 mucho tiempo | Vender solo porque RSI>70 en plena tendencia |
| MACD | 12, 26, 9 | Cruce MACD/señal y cruce de la línea 0; divergencias con el precio | Muchos cruces chicos cerca de 0 = ruido |
| ATR | 14 | Volatilidad absoluta en $ por vela. Se usa para stops y tamaño (ver skill `gestion-riesgo`) | No es direccional |
| Volumen | media 20 | Una ruptura con volumen > 1,5× la media es más confiable | En CEDEARs poco líquidos el volumen es errático; comparar contra su propia media, no contra el subyacente |

Necesitás al menos `periodo_más_largo × 2` velas antes de confiar en un indicador (warm-up). Durante el warm-up la señal es siempre `mantener`.

## Tendencia o lateral (filtro de régimen)

Clasificar el régimen **antes** de interpretar señales:

- **ADX(14)**: > 25 tendencia, < 20 lateral, entre 20 y 25 indefinido → no operar.
- **Pendiente de la EMA lenta** normalizada por ATR: `|EMA50[t] − EMA50[t−10]| / ATR < 0,5` ≈ lateral.
- **Ancho de Bandas de Bollinger** en mínimos relativos = compresión, posible ruptura.

Regla del proyecto: estrategias de cruce de medias solo operan en régimen de tendencia; señales de reversión por RSI solo en lateral.

## Cuándo una señal es débil

Bajar la confianza o devolver `mantener` si:

- Va contra la tendencia de un marco temporal mayor (ej. señal de compra en 5 min con EMA200 diaria bajando).
- No hay confirmación de volumen.
- El spread actual es mayor que ~0,3 × ATR (el costo se come el movimiento esperado).
- El ATR es tan chico que el take profit no cubre comisiones ida y vuelta (ver `api-iol`).
- Está a menos de 30 min de la apertura o del cierre de BYMA (subasta y spreads anchos).
- El subyacente en EE. UU. está cerrado (feriado de EE. UU.): el CEDEAR solo se mueve por CCL.
- Dos indicadores se contradicen (ej. cruce alcista de medias con divergencia bajista de MACD).

Guardar en `Signal.reason` qué condiciones se cumplieron y cuáles no, para poder auditar después.

## Evitar el sobreajuste

- Pocos parámetros: una estrategia con más de 3–4 parámetros libres es sospechosa.
- Usar valores redondos y estándar (14, 20, 50) antes que optimizados (17, 43).
- Probar **estabilidad**: si cambiar un parámetro ±20 % destruye el resultado, es ruido.
- Separar datos: optimizar en una ventana, validar en otra que no se tocó (walk-forward, ver skill `backtesting`).
- Mínimo ~30 operaciones fuera de muestra antes de sacar conclusiones; idealmente 100.
- Llevar registro de **cuántas variantes se probaron**: con muchas pruebas alguna sale bien por azar.
- La misma lógica debería funcionar razonablemente en NVDA y AMD; si solo funciona en uno, desconfiar.

## Implementación

- Funciones puras: `(velas: Candle[], params) => Signal`, sin I/O, testeables con series fijas.
- Tests con series sintéticas (tendencia, lateral, gap) que verifiquen la señal esperada.
- La señal **nunca** envía órdenes: pasa siempre por el gestor de riesgo.
