import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_COST_RATES, planTrade, type TradePlan } from '@bot-iol/shared';
import { fetchAtr, fetchQuote } from './api';
import { money, pct } from './format';
import { load, save } from './storage';

export interface PlannerSettings {
  symbol: string;
  capital: number;
  cash: number;
  entry: number;
  atr: number;
  atrMultiplier: number;
  rewardRatio: number;
  riskPct: number;
  maxExposurePct: number;
  dailyLossCapPct: number;
  realizedPnlToday: number;
  lossStreakToday: number;
  commissionPct: number;
  marketRightsPct: number;
}

const DEFAULTS: PlannerSettings = {
  symbol: 'NVDA',
  capital: 0,
  cash: 0,
  entry: 0,
  atr: 0,
  atrMultiplier: 2,
  rewardRatio: 2.5,
  riskPct: 1,
  maxExposurePct: 25,
  dailyLossCapPct: 2,
  realizedPnlToday: 0,
  lossStreakToday: 0,
  commissionPct: DEFAULT_COST_RATES.commissionPct,
  marketRightsPct: DEFAULT_COST_RATES.marketRightsPct,
};

const KEY = 'bot-iol.planner.v1';

type Field = { key: keyof PlannerSettings; label: string; step?: number; hint?: string };

const FIELDS: Field[] = [
  { key: 'capital', label: 'Capital total ($)', step: 1000, hint: 'Todo lo que tenés para invertir. El 1 % se calcula sobre esto.' },
  { key: 'cash', label: 'Efectivo disponible ($)', step: 1000 },
  { key: 'entry', label: 'Precio de entrada ($)', step: 5 },
  { key: 'atr', label: 'ATR(14) diario ($)', step: 5, hint: 'Cuánto se mueve en promedio por día.' },
  { key: 'atrMultiplier', label: 'Stop = k × ATR (k)', step: 0.1 },
  { key: 'rewardRatio', label: 'Take profit (R:R)', step: 0.1 },
  { key: 'riskPct', label: 'Riesgo por operación (%)', step: 0.1 },
  { key: 'maxExposurePct', label: 'Máx. en un CEDEAR (%)', step: 1 },
  { key: 'dailyLossCapPct', label: 'Tope pérdida diaria (%)', step: 0.5 },
  { key: 'realizedPnlToday', label: 'P&L realizado hoy ($)', step: 1000 },
  { key: 'lossStreakToday', label: 'Pérdidas seguidas hoy', step: 1 },
  { key: 'commissionPct', label: 'Comisión IOL (%)', step: 0.01, hint: 'Ponela según tu plan de IOL.' },
  { key: 'marketRightsPct', label: 'Derechos BYMA (%)', step: 0.01 },
];

export function Planner({ onPlan }: { onPlan?: (plan: TradePlan, settings: PlannerSettings) => void }) {
  const [s, setS] = useState<PlannerSettings>(() => load(KEY, DEFAULTS));
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => save(KEY, s), [s]);

  const plan = useMemo(
    () =>
      planTrade({
        ...s,
        costs: { commissionPct: s.commissionPct, marketRightsPct: s.marketRightsPct, ivaPct: 21 },
      }),
    [s],
  );
  useEffect(() => onPlan?.(plan, s), [plan, s, onPlan]);

  const set = (key: keyof PlannerSettings, value: string) =>
    setS((prev) => ({ ...prev, [key]: key === 'symbol' ? value.toUpperCase() : Number(value) }));

  async function fromIol(what: 'entry' | 'atr') {
    setBusy(what);
    setNote(null);
    try {
      if (what === 'entry') {
        const q = await fetchQuote(s.symbol);
        setS((p) => ({ ...p, entry: q.ask ?? q.last }));
        setNote(`Precio de IOL: ${money(q.ask ?? q.last)} (${new Date(q.timestamp).toLocaleString('es-AR')}). Revisá que sea de hoy.`);
      } else {
        const a = await fetchAtr(s.symbol);
        setS((p) => ({ ...p, atr: Math.round(a.atr) }));
        setNote(`ATR(${a.period}) con ${a.candles} velas diarias hasta ${new Date(a.lastDate).toLocaleDateString('es-AR')}.`);
      }
    } catch (err) {
      setNote(`No se pudo traer de IOL: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card wide">
      <header>
        <h2>Planificador de operación</h2>
        <span className="badge">Simulación: no envía órdenes</span>
      </header>
      <div className="form">
        <label>
          CEDEAR
          <input value={s.symbol} onChange={(e) => set('symbol', e.target.value)} maxLength={12} />
        </label>
        {FIELDS.map((f) => (
          <label key={f.key} title={f.hint}>
            {f.label}
            <span className="row">
              <input type="number" step={f.step} value={s[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              {(f.key === 'entry' || f.key === 'atr') && (
                <button type="button" onClick={() => fromIol(f.key as 'entry' | 'atr')} disabled={busy !== null}>
                  {busy === f.key ? '…' : 'IOL'}
                </button>
              )}
            </span>
          </label>
        ))}
      </div>
      {note && <p className="muted small">{note}</p>}
      <PlanResult plan={plan} symbol={s.symbol} />
    </article>
  );
}

function PlanResult({ plan, symbol }: { plan: TradePlan; symbol: string }) {
  return (
    <section className={plan.ok ? 'verdict ok' : 'verdict no'}>
      <h3>{plan.ok ? `Plan válido: comprar ${plan.quantity} ${symbol}` : 'No operar con estos números'}</h3>
      {plan.reasons.length > 0 && (
        <ul>
          {plan.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {plan.warnings.length > 0 && (
        <ul className="muted">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {plan.quantity > 0 && (
        <dl>
          <dt>Cantidad</dt>
          <dd>{plan.quantity} CEDEARs</dd>
          <dt>Monto (sin costos)</dt>
          <dd>
            {money(plan.exposure)} ({pct(plan.exposurePct)} del capital)
          </dd>
          <dt>Costo de la compra</dt>
          <dd>{money(plan.buyCost)}</dd>
          <dt>Entrada</dt>
          <dd>{money(plan.entry)}</dd>
          <dt>Stop loss</dt>
          <dd className="down">{money(plan.stop)}</dd>
          <dt>Take profit</dt>
          <dd className="up">{money(plan.takeProfit)}</dd>
          <dt>Punto de equilibrio</dt>
          <dd>{money(plan.breakEven)}</dd>
          <dt>Si toca el stop</dt>
          <dd className="down">−{money(plan.lossAtStop)}</dd>
          <dt>Si toca el take profit</dt>
          <dd className="up">+{money(plan.gainAtTarget)}</dd>
          <dt>R:R neto de comisiones</dt>
          <dd>{plan.netRewardRatio.toFixed(2)}</dd>
          <dt>Acierto mínimo para no perder</dt>
          <dd>{pct(plan.breakEvenWinRate * 100)}</dd>
          <dt>Tope diario restante</dt>
          <dd>
            {money(plan.dailyBudgetLeft)} de {money(plan.dailyLossCap)}
          </dd>
        </dl>
      )}
      <p className="muted small">
        Decidí el stop y el take profit antes de comprar y no los muevas. Si el precio toca el stop, se vende y ese día no se vuelve a entrar.
      </p>
    </section>
  );
}
