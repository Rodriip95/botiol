/**
 * Gestión de riesgo: funciones puras para planificar una operación.
 * Ver .claude/skills/gestion-riesgo. Nada de esto envía órdenes.
 */

/** Tasas de costo por operación (cada pata, compra o venta, por separado). */
export interface CostRates {
  /** Comisión del broker, en % del monto (ej. 0.5 = 0,5 %). Depende del plan de IOL. */
  commissionPct: number;
  /** Derechos de mercado BYMA, en % del monto. */
  marketRightsPct: number;
  /** IVA sobre comisión + derechos, en % (21 en Argentina). */
  ivaPct: number;
}

/**
 * Valores de referencia para arrancar. NO son el tarifario de tu cuenta:
 * reemplazalos por los de tu plan de IOL.
 */
export const DEFAULT_COST_RATES: CostRates = { commissionPct: 0.5, marketRightsPct: 0.08, ivaPct: 21 };

/** Costo total (comisión + derechos + IVA) de una pata por `amount` pesos. */
export function tradeCost(amount: number, rates: CostRates): number {
  const base = amount * ((rates.commissionPct + rates.marketRightsPct) / 100);
  return base * (1 + rates.ivaPct / 100);
}

/** Costo de una pata como fracción del monto (ej. 0.0070 = 0,70 %). */
export function costFraction(rates: CostRates): number {
  return tradeCost(1, rates);
}

export interface Candle {
  /** ISO 8601 */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * ATR de Wilder. Las velas deben venir ordenadas de la más vieja a la más nueva.
 * Devuelve null si no hay suficientes velas (`period + 1`).
 */
export function atr(candles: Candle[], period = 14): number | null {
  if (period < 1 || candles.length < period + 1) return null;
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prevClose = candles[i - 1]!.close;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) {
    value = (value * (period - 1) + tr[i]!) / period;
  }
  return value;
}

export interface TradePlanInput {
  /** Capital total (equity) actual, en pesos. El 1 % se calcula sobre esto. */
  capital: number;
  /** Efectivo disponible para comprar. Por defecto, igual al capital. */
  cash?: number;
  /** Precio de entrada previsto (por CEDEAR). */
  entry: number;
  /** ATR(14) en el mismo marco temporal en que se opera (diario). */
  atr: number;
  /** Multiplicador del ATR para el stop (1,5 a 2,5). Por defecto 2. */
  atrMultiplier?: number;
  /** R:R objetivo para el take profit. Por defecto 2. */
  rewardRatio?: number;
  /** R:R mínimo neto de comisiones para aceptar. Por defecto 1,5. */
  minNetRewardRatio?: number;
  /** % del capital que se arriesga. Por defecto 1, máximo 2. */
  riskPct?: number;
  /** % máximo del capital en un solo instrumento. Por defecto 25. */
  maxExposurePct?: number;
  /** Tope de pérdida diaria en % del capital. Por defecto 2. */
  dailyLossCapPct?: number;
  /** P&L realizado hoy (negativo si hubo pérdidas). Por defecto 0. */
  realizedPnlToday?: number;
  /** Pérdidas seguidas hoy. Con 3 o más no se opera. */
  lossStreakToday?: number;
  costs?: CostRates;
  /** Tick para redondear precios. Por defecto 5 (CEDEARs de este rango en BYMA). */
  tick?: number;
}

export interface TradePlan {
  ok: boolean;
  /** Motivos por los que NO conviene operar (vacío si ok). */
  reasons: string[];
  /** Advertencias que no bloquean. */
  warnings: string[];
  entry: number;
  stop: number;
  takeProfit: number;
  quantity: number;
  /** Monto de la compra sin costos. */
  exposure: number;
  /** % del capital invertido en la operación. */
  exposurePct: number;
  buyCost: number;
  /** Pérdida total si toca el stop, con costos de compra y venta. */
  lossAtStop: number;
  /** Ganancia neta si toca el take profit, con costos de compra y venta. */
  gainAtTarget: number;
  /** gainAtTarget / lossAtStop. */
  netRewardRatio: number;
  /** Precio de venta a partir del cual la operación da ganancia neta. */
  breakEven: number;
  /** Pesos que se aceptan perder en esta operación. */
  riskBudget: number;
  /** Pérdida diaria máxima, en pesos. */
  dailyLossCap: number;
  /** Lo que queda del tope diario antes de esta operación. */
  dailyBudgetLeft: number;
  /** Acierto mínimo para no perder plata con este R:R neto. */
  breakEvenWinRate: number;
}

const roundDown = (x: number, tick: number) => Math.floor(x / tick) * tick;
const roundUp = (x: number, tick: number) => Math.ceil(x / tick) * tick;
const isPos = (x: number) => Number.isFinite(x) && x > 0;

/**
 * Arma el plan de una compra (largo) con 1 % de riesgo, stop por ATR, take profit
 * por R:R, comisiones incluidas y tope de pérdida diaria. Si algo no cierra,
 * devuelve ok=false con los motivos: ante la duda, no operar.
 */
export function planTrade(input: TradePlanInput): TradePlan {
  const {
    capital,
    entry,
    atr: atrValue,
    atrMultiplier = 2,
    rewardRatio = 2,
    minNetRewardRatio = 1.5,
    riskPct = 1,
    maxExposurePct = 25,
    dailyLossCapPct = 2,
    realizedPnlToday = 0,
    lossStreakToday = 0,
    costs = DEFAULT_COST_RATES,
    tick = 5,
  } = input;
  const cash = input.cash ?? capital;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!isPos(capital)) reasons.push('Falta el capital total.');
  if (!isPos(entry)) reasons.push('Falta el precio de entrada.');
  if (!isPos(atrValue)) reasons.push('Falta el ATR.');
  if (!(cash >= 0)) reasons.push('El efectivo disponible no es válido.');
  if (riskPct > 2) reasons.push('El riesgo por operación no puede superar el 2 % (la regla del proyecto es 1 %).');
  if (rewardRatio < minNetRewardRatio) reasons.push(`El R:R objetivo (${rewardRatio}) es menor al mínimo (${minNetRewardRatio}).`);

  const cf = costFraction(costs);
  const dailyLossCap = Math.max(0, capital) * (dailyLossCapPct / 100);
  const dailyBudgetLeft = Math.max(0, dailyLossCap + Math.min(0, realizedPnlToday));

  if (reasons.length > 0) {
    return emptyPlan({ entry, reasons, warnings, dailyLossCap, dailyBudgetLeft });
  }

  if (dailyBudgetLeft <= 0) {
    reasons.push('Ya alcanzaste el tope de pérdida diaria: hoy no se opera más.');
  }
  if (lossStreakToday >= 3) {
    reasons.push('Llevás 3 pérdidas seguidas hoy: no se abren más posiciones hasta mañana.');
  }

  const stop = roundDown(entry - atrMultiplier * atrValue, tick);
  const stopDistance = entry - stop;
  const takeProfit = roundUp(entry + rewardRatio * stopDistance, tick);
  if (stop <= 0) reasons.push('El stop queda en cero o negativo: el ATR es demasiado grande para este precio.');

  // Riesgo por unidad: distancia al stop + costos de compra (a entry) y venta (a stop).
  const riskPerUnit = stopDistance + entry * cf + stop * cf;
  const riskBudget = Math.min(capital * (riskPct / 100), dailyBudgetLeft);
  if (riskBudget < capital * (riskPct / 100)) {
    warnings.push('El riesgo se achicó para no pasar el tope de pérdida diaria.');
  }

  let quantity = riskPerUnit > 0 ? Math.floor(riskBudget / riskPerUnit) : 0;
  const byCash = Math.floor(cash / (entry * (1 + cf)));
  const byExposure = Math.floor((capital * (maxExposurePct / 100)) / entry);
  if (byCash < quantity) {
    quantity = byCash;
    warnings.push('La cantidad se limitó por el efectivo disponible.');
  }
  if (byExposure < quantity) {
    quantity = byExposure;
    warnings.push(`La cantidad se limitó para no pasar el ${maxExposurePct} % del capital en un solo CEDEAR.`);
  }
  quantity = Math.max(0, quantity);
  if (quantity < 1 && reasons.length === 0) {
    reasons.push('No alcanza para 1 CEDEAR sin pasar el riesgo permitido: el stop es demasiado ancho para tu capital.');
  }

  const exposure = quantity * entry;
  const buyCost = tradeCost(exposure, costs);
  const lossAtStop = quantity * stopDistance + buyCost + tradeCost(quantity * stop, costs);
  const gainAtTarget = quantity * (takeProfit - entry) - buyCost - tradeCost(quantity * takeProfit, costs);
  const netRewardRatio = lossAtStop > 0 ? gainAtTarget / lossAtStop : 0;
  if (quantity >= 1 && netRewardRatio < minNetRewardRatio) {
    reasons.push(
      `Neto de comisiones el R:R es ${netRewardRatio.toFixed(2)}, menor al mínimo ${minNetRewardRatio}: las comisiones se comen la ganancia.`,
    );
  }
  const breakEven = roundUp((entry * (1 + cf)) / (1 - cf), 0.01);
  const breakEvenWinRate = netRewardRatio > 0 ? 1 / (1 + netRewardRatio) : 1;

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    entry,
    stop,
    takeProfit,
    quantity,
    exposure,
    exposurePct: capital > 0 ? (exposure / capital) * 100 : 0,
    buyCost,
    lossAtStop,
    gainAtTarget,
    netRewardRatio,
    breakEven,
    riskBudget,
    dailyLossCap,
    dailyBudgetLeft,
    breakEvenWinRate,
  };
}

function emptyPlan(p: {
  entry: number;
  reasons: string[];
  warnings: string[];
  dailyLossCap: number;
  dailyBudgetLeft: number;
}): TradePlan {
  return {
    ok: false,
    reasons: p.reasons,
    warnings: p.warnings,
    entry: p.entry,
    stop: 0,
    takeProfit: 0,
    quantity: 0,
    exposure: 0,
    exposurePct: 0,
    buyCost: 0,
    lossAtStop: 0,
    gainAtTarget: 0,
    netRewardRatio: 0,
    breakEven: 0,
    riskBudget: 0,
    dailyLossCap: p.dailyLossCap,
    dailyBudgetLeft: p.dailyBudgetLeft,
    breakEvenWinRate: 1,
  };
}
