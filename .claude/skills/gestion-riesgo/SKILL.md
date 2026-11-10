---
name: gestion-riesgo
description: Usar al implementar o revisar el gestor de riesgo del bot: tamaño de posición con 1% de riesgo, stops con ATR, relación riesgo/beneficio, tope de pérdida diaria, máximo de posiciones y drawdown.
---

# Gestión de riesgo

El gestor de riesgo tiene **la última palabra** antes de cada orden, en simulación y en real. Si cualquier chequeo falla, la orden se rechaza y se registra el motivo. Ante la duda, no operar.

## Reglas fijas del proyecto

- Riesgo máximo por operación: **1 % del capital** (equity actual, no el inicial).
- Toda posición nace con **stop loss y take profit**. Sin stop no hay orden.
- **Tope de pérdida diaria**: al alcanzarlo, el bot cierra lo que corresponda, se apaga y no reabre hasta el día siguiente (o reactivación manual).
- **Máximo de posiciones abiertas** simultáneas (configurable, arrancar con 2).
- Solo en horario bursátil (ver `mercado-argentino-cedears`).

## Stop con ATR

```
stop_compra = entrada − k × ATR(14)      k entre 1,5 y 2,5 (arrancar con 2)
stop_venta  = entrada + k × ATR(14)
```

El ATR se calcula en el mismo marco temporal en que se opera. Redondear el stop al tick del instrumento.

## Tamaño de la posición

```
riesgo_$          = equity × 0,01
riesgo_por_unidad = |entrada − stop| + costo_por_unidad_ida_y_vuelta
cantidad          = floor(riesgo_$ / riesgo_por_unidad)
```

Luego aplicar topes, en este orden:

1. `cantidad × entrada ≤ efectivo_disponible` (contando comisiones de la compra).
2. `cantidad × entrada ≤ equity × max_exposición_por_instrumento` (ej. 25 %).
3. Si `cantidad < 1`, **no operar**: el stop es demasiado ancho para el capital.

Los CEDEARs se operan por unidad (lote 1). `costo_por_unidad` incluye comisión, derechos de mercado e IVA (ver `api-iol`).

Ejemplo: equity $1.000.000, entrada $15.000, ATR $300, k = 2 → stop $14.400, riesgo/unidad ≈ $600 + $150 de costos = $750; riesgo $10.000 → 13 unidades ($195.000 de exposición).

## Relación riesgo/beneficio

```
take_profit = entrada + R × |entrada − stop|        R mínimo 1,5 (preferible 2)
```

Rechazar la operación si, **neta de comisiones**, la ganancia esperada al TP es menor que 1,5 × la pérdida esperada al SL. Con pocas operaciones ganadoras (acierto < 40 %) se necesita R ≥ 2 para tener expectativa positiva.

## Tope diario y drawdown

- `pnl_dia = realizado_hoy + no_realizado_abiertas`. Si `pnl_dia ≤ −tope_diario` (arrancar con 2 % del equity de apertura), apagar el bot.
- Drawdown: `dd = (pico_equity − equity) / pico_equity`. Si `dd ≥ 10 %`, apagar y exigir revisión manual. Con `dd ≥ 5 %`, reducir el riesgo por operación a 0,5 %.
- Racha: después de 3 pérdidas seguidas en el día, no abrir más posiciones ese día.
- Persistir el estado (pico de equity, pnl del día, si el bot está apagado) en la base, para que un reinicio no lo resetee.

## Chequeos previos a cada orden (en este orden)

1. Bot encendido y modo correcto (simulación/real).
2. Mercado abierto y no en los primeros/últimos 15–30 min.
3. Tope diario y drawdown no alcanzados.
4. Posiciones abiertas < máximo; no hay ya una posición en ese instrumento.
5. Stop y TP definidos y del lado correcto del precio.
6. Tamaño ≥ 1 y dentro de los topes de efectivo y exposición.
7. Spread actual razonable (< ~0,5 % del precio).

## Implementación

- Funciones puras y testeadas: `positionSize`, `atrStop`, `takeProfit`, `checkOrder(state, order) => { ok, reasons[] }`.
- Usar enteros en centavos o un tipo decimal para dinero; nunca comparar floats con `===`.
- El botón de emergencia del panel pone el bot en apagado y cancela órdenes pendientes.
