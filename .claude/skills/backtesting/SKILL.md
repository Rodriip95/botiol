---
name: backtesting
description: Usar al construir o revisar el backtester, la simulación (paper trading) o el cálculo de métricas: evitar sesgo de anticipación, walk-forward, y métricas netas de comisiones como Sharpe, % de acierto, expectativa y drawdown máximo.
---

# Backtesting y evaluación

Objetivo: que el resultado del backtest se parezca a lo que pasaría en real. Un backtest optimista es peor que no tener backtest.

## Sin sesgo de anticipación (look-ahead)

En cada paso el backtester solo puede ver datos **ya conocidos** en ese momento:

- La señal se calcula con la vela **cerrada** en `t` y la orden se ejecuta en la **apertura de `t+1`** (o al precio de la punta en `t+1`), nunca al cierre de `t`.
- Indicadores calculados de forma incremental o recortando la serie a `velas[0..t]`. Prohibido calcular sobre toda la serie y después indexar si el indicador usa ventanas centradas o normaliza con datos futuros (máximos/mínimos globales, z-scores de toda la serie).
- Stops y TPs dentro de una vela: si en la misma vela se tocan ambos, asumir que primero se tocó el **stop** (supuesto conservador).
- Ratios de CEDEAR, comisiones y feriados según el valor **vigente en esa fecha**.
- No usar series "ajustadas" con información futura sin entender el ajuste.
- Test obligatorio: correr el backtest con los datos truncados en `t` y verificar que las señales hasta `t` no cambian.

## Costos realistas

- Comisión + derechos de mercado + IVA en cada pata (ver `api-iol`).
- Slippage: ejecutar a la punta contraria; si solo hay último precio, sumar medio spread estimado (mín. 0,1 %).
- No operar en horarios ni días en que el bot real no operaría (ver `mercado-argentino-cedears`).

## Validación

1. **Separar datos**: entrenamiento (optimizar) / validación / prueba final que se mira una sola vez.
2. **Walk-forward**: optimizar en una ventana (ej. 6 meses), operar los 2 meses siguientes, desplazar y repetir. Reportar solo los tramos fuera de muestra.
3. **Robustez**: variar cada parámetro ±20 %; probar en NVDA y AMD; probar en períodos de suba, baja y lateral.
4. **Benchmark**: comparar contra comprar y mantener el mismo CEDEAR en el mismo período, neto de costos.
5. **Tamaño de muestra**: menos de 30 operaciones no permite concluir nada.
6. Después del backtest, varias semanas de **simulación en vivo** (paso 7 de la guía) antes de pasar a real.

## Métricas (todas netas de costos)

```
tasa_acierto   = ganadoras / total
ganancia_media = promedio de trades ganadores ($)
pérdida_media  = promedio |trades perdedores| ($)
expectativa    = tasa_acierto × ganancia_media − (1 − tasa_acierto) × pérdida_media   // $ por operación
expectativa_R  = expectativa / riesgo_medio_por_operación                             // en múltiplos de R
profit_factor  = suma_ganancias / suma_pérdidas
drawdown_max   = max_t (pico_equity_hasta_t − equity_t) / pico_equity_hasta_t
sharpe_anual   = media(ret_diarios) / desvío(ret_diarios) × √252                      // tasa libre de riesgo ≈ 0 o explicitarla
```

- Calcular Sharpe con **retornos diarios de la curva de equity** (incluyendo días sin operaciones), no por trade.
- Reportar P&L en pesos y en dólares (CCL) para separar el efecto de la devaluación.
- Reportar también: cantidad de operaciones, tiempo promedio en posición, exposición (% del tiempo invertido), peor racha de pérdidas, costos totales pagados.
- Señales de alarma: Sharpe > 3, profit factor > 3 o curva sin drawdowns → buscar un bug o look-ahead antes de festejar.

## Implementación

- El backtester y el modo simulación comparten el **mismo** motor de estrategia y gestor de riesgo que el modo real; solo cambia el ejecutor de órdenes.
- Métricas como funciones puras sobre `Trade[]` y la curva de equity, con tests de casos conocidos.
- Guardar cada corrida (parámetros, período, métricas) para comparar y para contar cuántas variantes se probaron.
