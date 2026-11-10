import { describe, expect, it } from 'vitest';
import {
  PAST_TRADES,
  atr,
  costFraction,
  planTrade,
  summarizeJournal,
  tradeCost,
  winsToRecover,
  type Candle,
} from '@bot-iol/shared';

const rates = { commissionPct: 0.5, marketRightsPct: 0.08, ivaPct: 21 };

describe('costos', () => {
  it('comisión + derechos + IVA', () => {
    expect(tradeCost(100_000, rates)).toBeCloseTo(701.8, 6);
    expect(costFraction(rates)).toBeCloseTo(0.007018, 9);
  });
});

describe('atr', () => {
  const c = (high: number, low: number, close: number): Candle => ({ time: '', open: close, high, low, close });

  it('null si faltan velas', () => {
    expect(atr([c(10, 9, 9.5)], 14)).toBeNull();
  });

  it('rango verdadero con gap y suavizado de Wilder', () => {
    // TR: 2 (gap: |12-10|), 1, 3 → ATR(2) = ((2+1)/2 · 1 + 3) / 2 = 2,25
    const candles = [c(10, 9, 10), c(12, 11, 11.5), c(12, 11, 11), c(13, 10, 12)];
    expect(atr(candles, 2)).toBeCloseTo(2.25, 9);
  });
});

describe('planTrade', () => {
  const base = { capital: 1_000_000, entry: 15_000, atr: 300, costs: rates };

  it('ejemplo de la skill: stop 2×ATR y 1 % de riesgo con costos', () => {
    const plan = planTrade({ ...base, rewardRatio: 2.5 });
    expect(plan.ok).toBe(true);
    expect(plan.stop).toBe(14_400);
    expect(plan.takeProfit).toBe(16_500);
    expect(plan.quantity).toBe(12);
    expect(plan.lossAtStop).toBeLessThanOrEqual(10_000);
    expect(plan.netRewardRatio).toBeGreaterThanOrEqual(1.5);
    expect(plan.breakEven).toBeGreaterThan(15_000);
  });

  it('rechaza si las comisiones dejan el R:R neto bajo el mínimo', () => {
    const plan = planTrade({ ...base, rewardRatio: 2 });
    expect(plan.ok).toBe(false);
    expect(plan.reasons.join(' ')).toMatch(/comisiones/);
    expect(plan.netRewardRatio).toBeLessThan(1.5);
  });

  it('no opera si ya se alcanzó el tope diario', () => {
    const plan = planTrade({ ...base, rewardRatio: 2.5, realizedPnlToday: -20_000 });
    expect(plan.ok).toBe(false);
    expect(plan.dailyBudgetLeft).toBe(0);
  });

  it('achica el riesgo para no pasar el tope diario', () => {
    const plan = planTrade({ ...base, rewardRatio: 2.5, realizedPnlToday: -15_000 });
    expect(plan.riskBudget).toBe(5_000);
    expect(plan.lossAtStop).toBeLessThanOrEqual(5_000);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('no opera con 3 pérdidas seguidas', () => {
    expect(planTrade({ ...base, rewardRatio: 2.5, lossStreakToday: 3 }).ok).toBe(false);
  });

  it('limita por exposición máxima y por efectivo', () => {
    const tight = planTrade({ ...base, atr: 20, rewardRatio: 2.5, maxExposurePct: 10 });
    expect(tight.exposure).toBeLessThanOrEqual(100_000);
    const poor = planTrade({ ...base, rewardRatio: 2.5, cash: 50_000 });
    expect(poor.quantity).toBe(3);
  });

  it('no opera si no alcanza para 1 CEDEAR', () => {
    const plan = planTrade({ ...base, capital: 30_000, rewardRatio: 2.5 });
    expect(plan.ok).toBe(false);
    expect(plan.quantity).toBe(0);
  });

  it('rechaza riesgo por operación mayor a 2 %', () => {
    expect(planTrade({ ...base, rewardRatio: 2.5, riskPct: 5 }).ok).toBe(false);
  });
});

describe('journal', () => {
  it('suma las pérdidas de las capturas', () => {
    const s = summarizeJournal(PAST_TRADES);
    expect(s.trades.map((t) => t.pnl)).toEqual([-115_500, -149_988, -266_360]);
    expect(s.totalPnl).toBe(-531_848);
    expect(s.losses).toBe(3);
    expect(s.worstCumulativePnl).toBe(-531_848);
  });

  it('winsToRecover', () => {
    expect(winsToRecover(531_848, 20_000)).toBe(27);
    expect(winsToRecover(0, 20_000)).toBe(0);
  });
});
