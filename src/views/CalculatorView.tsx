import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CedearQuote, MarketSnapshot } from '../lib/types';
import { BENCHMARK, SECTOR_COLOR } from '../data/catalog';
import { useHistory } from '../data/hooks';
import { entriesRepo } from '../data/entries';
import { useAuth } from '../auth/AuthContext';
import { computePnl } from '../lib/pnl';
import { MIN_DATE, parseAmount, todayIso, validateCalc, type CalcErrors, type CalcForm, type ParsedCalc } from '../lib/validation';
import { amountInput, int, money, money0, pct, short, signedMoney, signedPct, tone, usd } from '../lib/format';
import { CedearPicker } from '../components/CedearPicker';
import { AreaChart } from '../components/Charts';
import { Card, Empty, Kpi, Skeleton } from '../components/Ui';
import { GoogleMark, Icon } from '../components/Icon';

const EMPTY_FORM: CalcForm = { symbol: '', quantity: '', invested: '', date: '' };

export interface CalcPreset {
  form: Partial<CalcForm>;
  /** true = trae todos los datos (desde el historial) y se calcula al llegar. */
  full: boolean;
  /** Contador para que el mismo símbolo dos veces dispare el efecto. */
  n: number;
}

export function CalculatorView({
  snapshot,
  bySymbol,
  presetSymbol,
  onToast,
}: {
  snapshot: MarketSnapshot | null;
  bySymbol: ReadonlyMap<string, CedearQuote>;
  presetSymbol: CalcPreset | null;
  onToast: (msg: string) => void;
}) {
  const quotes = snapshot?.quotes ?? [];
  const { user, signIn } = useAuth();
  const [form, setForm] = useState<CalcForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<CalcErrors>({});
  const [calc, setCalc] = useState<ParsedCalc | null>(null);
  const [saving, setSaving] = useState<'query' | 'portfolio' | null>(null);
  const [saved, setSaved] = useState(false);

  const known = useMemo(() => new Set(quotes.map((q) => q.symbol)), [quotes]);

  // Prefill desde el buscador, el mercado o el historial. Si viene completo, calcula directo.
  useEffect(() => {
    if (!presetSymbol) return;
    const next: CalcForm = presetSymbol.full ? { ...EMPTY_FORM, ...presetSymbol.form } : { ...form, ...presetSymbol.form };
    setForm(next);
    setErrors({});
    if (presetSymbol.full) {
      const r = validateCalc(next, known);
      if (r.ok) {
        setCalc(r.value);
        setSaved(true); // ya está guardada
      }
    } else {
      setCalc(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetSymbol]);
  const history = useHistory(calc?.symbol ?? null);
  const bench = useHistory(calc?.date ? BENCHMARK : null);

  const quote = calc ? bySymbol.get(calc.symbol) : undefined;
  const result = useMemo(() => {
    if (!calc || !quote) return null;
    return computePnl({
      quote,
      quantity: calc.quantity,
      invested: calc.invested,
      date: calc.date,
      mep: snapshot?.mep ?? null,
      history: history.data,
      benchmarkQuote: bySymbol.get(BENCHMARK) ?? null,
      benchmarkHistory: bench.data,
    });
  }, [calc, quote, snapshot?.mep, history.data, bench.data, bySymbol]);

  const set = (k: keyof CalcForm) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = validateCalc(form, known);
    if (!r.ok) {
      setErrors(r.errors);
      const first = (['symbol', 'quantity', 'invested', 'date'] as const).find((k) => r.errors[k]);
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setErrors({});
    setCalc(r.value);
    setSaved(false);
  };

  const save = async (inPortfolio: boolean) => {
    if (!calc || !result) return;
    if (!user) {
      await signIn().catch(() => onToast('No pudimos iniciar sesión'));
      return;
    }
    setSaving(inPortfolio ? 'portfolio' : 'query');
    try {
      await entriesRepo.add(user.uid, {
        symbol: calc.symbol,
        quantity: calc.quantity,
        invested: calc.invested,
        date: calc.date,
        inPortfolio,
        snapshot: { price: result.price, pnl: result.pnl, pnlPct: result.pnlPct },
      });
      setSaved(true);
      onToast(inPortfolio ? `${calc.symbol} agregado a tu portfolio` : 'Consulta guardada en tu historial');
    } catch (err) {
      onToast(err instanceof Error ? `Error al guardar: ${err.message}` : 'Error al guardar');
    } finally {
      setSaving(null);
    }
  };

  const movers = useMemo(() => {
    const liquid = quotes.filter((q) => q.volume * q.last > 5e6);
    const pool = liquid.length > 5 ? liquid : quotes;
    const up = [...pool].sort((a, b) => b.changePct - a.changePct)[0];
    const down = [...pool].sort((a, b) => a.changePct - b.changePct)[0];
    const top = [...pool].sort((a, b) => b.volume * b.last - a.volume * a.last)[0];
    return { up, down, top };
  }, [quotes]);

  const warning =
    result?.paidVsClosePct != null && Math.abs(result.paidVsClosePct) > 25
      ? `Pagaste ${money(result.avgCost)} por nominal y ese día el cierre fue ${money(result.closeOnDate!)} (${signedPct(result.paidVsClosePct)}). Revisá el monto total, los nominales o la fecha.`
      : null;

  return (
    <div className="view">
      <section className="hero">
        <div className="hero__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" /> Calculadora de CEDEARs
          </span>
          <h1 className="hero__title">
            FODEARS
          </h1>
          <p className="hero__sub">
            Tu <b>port<em>FO</em>lio</b> de <b>ce<em>DEARS</em></b>. Cargá qué compraste, cuántos nominales y cuánto pagaste: te
            decimos si hoy vas ganando o perdiendo, y cómo te fue contra el mercado.
          </p>
        </div>
        <div className="hero__kpis">
          {snapshot ? (
            <>
              <Kpi
                featured
                icon="dollar"
                label="Dólar MEP implícito"
                value={snapshot.mep ? money(snapshot.mep) : '—'}
                foot="mediana de CEDEARs"
                bars={[5, 7, 6, 8, 7, 9, 8, 10]}
              />
              {movers.up && (
                <Kpi
                  icon="arrowUp"
                  label={`Mayor suba · ${movers.up.symbol}`}
                  value={money(movers.up.last)}
                  delta={signedPct(movers.up.changePct)}
                  deltaTone="up"
                  foot="hoy"
                />
              )}
              {movers.down && (
                <Kpi
                  icon="arrowDown"
                  label={`Mayor baja · ${movers.down.symbol}`}
                  value={money(movers.down.last)}
                  delta={signedPct(movers.down.changePct)}
                  deltaTone="down"
                  foot="hoy"
                />
              )}
              {movers.top && (
                <Kpi
                  icon="flame"
                  label={`Más operado · ${movers.top.symbol}`}
                  value={`$ ${short(movers.top.volume * movers.top.last)}`}
                  delta={signedPct(movers.top.changePct)}
                  deltaTone={tone(movers.top.changePct)}
                  foot="volumen"
                />
              )}
            </>
          ) : (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="kpi">
                <Skeleton h={14} w="60%" />
                <Skeleton h={30} w="80%" />
              </div>
            ))
          )}
        </div>
      </section>

      <div className="calc-grid">
        <Card title="¿Qué compraste?" icon="calc" className="calc-form-card">
          <form className="form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="f-symbol">CEDEAR</label>
              <div>
                <CedearPicker
                  inputId="f-symbol"
                  quotes={quotes}
                  value={form.symbol}
                  onChange={set('symbol')}
                  invalid={!!errors.symbol}
                  describedBy={errors.symbol ? 'e-symbol' : undefined}
                />
              </div>
              {errors.symbol && (
                <p className="field__error" id="e-symbol" role="alert">
                  {errors.symbol}
                </p>
              )}
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="f-quantity">Nominales</label>
                <input
                  id="f-quantity"
                  inputMode="numeric"
                  placeholder="Ej. 25"
                  value={form.quantity}
                  aria-invalid={!!errors.quantity || undefined}
                  aria-describedby={errors.quantity ? 'e-quantity' : 'h-quantity'}
                  onChange={(e) => set('quantity')(e.target.value.replace(/[^\d.]/g, ''))}
                />
                {errors.quantity ? (
                  <p className="field__error" id="e-quantity" role="alert">
                    {errors.quantity}
                  </p>
                ) : (
                  <p className="field__hint" id="h-quantity">
                    Cantidad de CEDEARs
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="f-invested">Total invertido</label>
                <div className="input-prefix">
                  <span>$</span>
                  <input
                    id="f-invested"
                    inputMode="decimal"
                    placeholder="150.000,00"
                    value={form.invested}
                    aria-invalid={!!errors.invested || undefined}
                    aria-describedby={errors.invested ? 'e-invested' : 'h-invested'}
                    onChange={(e) => set('invested')(e.target.value.replace(/[^\d.,]/g, ''))}
                    onBlur={(e) => {
                      // Al salir del campo, lo muestra con formato argentino: 101180 → 101.180,00
                      const n = parseAmount(e.currentTarget.value);
                      if (n !== null && n > 0) setForm((f) => ({ ...f, invested: amountInput(n) }));
                    }}
                  />
                </div>
                {errors.invested ? (
                  <p className="field__error" id="e-invested" role="alert">
                    {errors.invested}
                  </p>
                ) : (
                  <p className="field__hint" id="h-invested">
                    Total pagado en pesos
                  </p>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="f-date">
                Fecha de compra <span className="optional">opcional</span>
              </label>
              <input
                id="f-date"
                type="date"
                min={MIN_DATE}
                max={todayIso()}
                value={form.date}
                aria-invalid={!!errors.date || undefined}
                aria-describedby={errors.date ? 'e-date' : 'h-date'}
                onChange={(e) => set('date')(e.target.value)}
              />
              {errors.date ? (
                <p className="field__error" id="e-date" role="alert">
                  {errors.date}
                </p>
              ) : (
                <p className="field__hint" id="h-date">
                  Con la fecha calculamos rendimiento anual y comparamos contra el {BENCHMARK}
                </p>
              )}
            </div>

            <button type="submit" className="btn btn--lime btn--block" disabled={!snapshot}>
              <Icon name="bolt" size={16} /> Calcular ganancia
            </button>
            {calc && (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setCalc(null);
                  setErrors({});
                }}
              >
                Nueva consulta
              </button>
            )}
          </form>
        </Card>

        <div className="calc-result">
          {!calc && (
            <Card className="result-empty">
              <Empty icon="target" title="Tu resultado aparece acá">
                <p>Elegí un CEDEAR, cargá los nominales y el total que pagaste. La fecha es opcional.</p>
                <div className="chips">
                  {['AAPL', 'MELI', 'NVDA', 'SPY', 'KO'].filter((s) => known.has(s)).map((s) => (
                    <button key={s} className="chip" onClick={() => set('symbol')(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </Empty>
            </Card>
          )}

          {calc && !quote && <Card><Empty icon="info" title="No hay cotización para este CEDEAR ahora" /></Card>}

          {calc && result && quote && (
            <>
              <div className={`verdict verdict--${tone(result.pnl)}`}>
                <div className="verdict__main">
                  <span className="ticker-badge ticker-badge--lg" style={{ ['--c' as string]: SECTOR_COLOR[quote.sector] }}>
                    {quote.symbol.slice(0, 4)}
                  </span>
                  <div>
                    <p className="verdict__eyebrow">
                      {quote.name} · {int(result.quantity)} nominales
                    </p>
                    <h2 className="verdict__title">
                      {result.pnl > 0 ? 'Vas ganando' : result.pnl < 0 ? 'Vas perdiendo' : 'Estás hecho'}{' '}
                      <span>{signedMoney(result.pnl)}</span>
                    </h2>
                  </div>
                </div>
                <span className={`verdict__pct delta delta--${tone(result.pnl)}`}>
                  <Icon name={result.pnl >= 0 ? 'arrowUp' : 'arrowDown'} size={16} />
                  {signedPct(result.pnlPct)}
                </span>
              </div>

              {warning && (
                <p className="banner banner--warn" role="status">
                  <Icon name="info" size={16} /> {warning}
                </p>
              )}

              <div className="kpi-row">
                <Kpi featured icon="wallet" label="Valor actual" value={money(result.value)} foot={`a ${money(result.price)} c/u`} bars={result.series.slice(-10).map((p) => p.value)} />
                <Kpi icon="calc" label="Invertido" value={money(result.invested)} foot={`${money(result.avgCost)} promedio`} />
                <Kpi
                  icon="dollar"
                  label="Valor en dólares"
                  value={result.valueUsd !== null ? usd(result.valueUsd) : '—'}
                  foot={snapshot?.mep ? `MEP ${money0(snapshot.mep)}` : 'sin MEP'}
                />
                <Kpi
                  icon="target"
                  label="Break even"
                  value={money(result.breakEven)}
                  delta={result.pnl >= 0 ? 'superado' : signedPct(result.toBreakEvenPct)}
                  deltaTone={result.pnl >= 0 ? 'up' : 'down'}
                  foot={result.pnl >= 0 ? 'por nominal' : 'para salir hecho'}
                />
              </div>

              <div className="result-grid">
                <Card
                  title={calc.date ? 'Tu posición desde la compra' : 'Tu posición en el último año'}
                  icon="market"
                  className="result-chart"
                  action={<span className="muted">{history.loading ? 'cargando…' : `${history.data.length ? 'cierres diarios' : ''}`}</span>}
                >
                  {history.loading ? (
                    <Skeleton h={220} />
                  ) : history.error ? (
                    <Empty icon="info" title="No pudimos traer el histórico" />
                  ) : (
                    <AreaChart data={[...result.series, { date: todayIso(), value: result.value }]} baseline={result.invested} />
                  )}
                </Card>

                <Card title="Contra el mercado" icon="star" className="result-bench">
                  {!calc.date ? (
                    <Empty icon="calendar" title="Agregá la fecha de compra">
                      <p>Con la fecha comparamos tu compra contra haber puesto la misma plata en el {BENCHMARK}.</p>
                    </Empty>
                  ) : bench.loading ? (
                    <Skeleton h={140} />
                  ) : result.benchmark ? (
                    <div className="bench">
                      <div className="bench__bars">
                        <BenchBar label={quote.symbol} pct={result.pnlPct} max={Math.max(Math.abs(result.pnlPct), Math.abs(result.benchmark.returnPct))} />
                        <BenchBar
                          label={result.benchmark.symbol}
                          pct={result.benchmark.returnPct}
                          max={Math.max(Math.abs(result.pnlPct), Math.abs(result.benchmark.returnPct))}
                          muted
                        />
                      </div>
                      <p className={`bench__verdict t-${tone(result.benchmark.alphaPct)}`}>
                        {result.benchmark.alphaPct >= 0 ? 'Le ganaste' : 'Te ganó'} al {result.benchmark.symbol} por{' '}
                        <b>{pct(Math.abs(result.benchmark.alphaPct))}</b> puntos
                      </p>
                      <p className="muted">
                        La misma plata en {result.benchmark.symbol} hoy valdría <b>{money0(result.benchmark.value)}</b>.
                      </p>
                    </div>
                  ) : quote.symbol === BENCHMARK ? (
                    <Empty icon="star" title={`Compraste el ${BENCHMARK}: sos el mercado`} />
                  ) : (
                    <Empty icon="info" title="Sin datos del benchmark para esa fecha" />
                  )}
                </Card>

                <Card title="Detalle" icon="info" className="result-detail">
                  <dl className="dl">
                    <div>
                      <dt>Precio actual</dt>
                      <dd>
                        {money(quote.last)} <small className={`t-${tone(quote.changePct)}`}>{signedPct(quote.changePct)} hoy</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Puntas (compra / venta)</dt>
                      <dd>
                        {quote.bid ? money(quote.bid) : '—'} / {quote.ask ? money(quote.ask) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Si vendés ya (a la punta compradora)</dt>
                      <dd>{result.liquidationValue !== null ? money(result.liquidationValue) : '—'}</dd>
                    </div>
                    {quote.usdMep !== null && (
                      <div>
                        <dt>Precio en dólares MEP ({quote.symbol}D)</dt>
                        <dd>{usd(quote.usdMep)}</dd>
                      </div>
                    )}
                    {result.daysHeld !== null && (
                      <div>
                        <dt>Tiempo invertido</dt>
                        <dd>{int(result.daysHeld)} días</dd>
                      </div>
                    )}
                    {result.annualizedPct !== null && (
                      <div>
                        <dt>Rendimiento anualizado</dt>
                        <dd className={`t-${tone(result.annualizedPct)}`}>{signedPct(result.annualizedPct)}</dd>
                      </div>
                    )}
                    {result.closeOnDate !== null && (
                      <div>
                        <dt>Cierre el día de compra</dt>
                        <dd>{money(result.closeOnDate)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Volumen hoy</dt>
                      <dd>
                        {int(quote.volume)} nominales · {int(quote.trades)} operaciones
                      </dd>
                    </div>
                  </dl>
                </Card>
              </div>

              <div className="save-bar">
                <div>
                  <strong>{user ? 'Guardá esta consulta' : 'Ingresá para guardar'}</strong>
                  <p className="muted">
                    {user
                      ? 'Queda en tu historial y, si querés, en tu portfolio para seguirla contra el mercado.'
                      : 'Con tu cuenta de Google guardás consultas y armás tu portfolio de CEDEARs.'}
                  </p>
                </div>
                {user ? (
                  <div className="save-bar__actions">
                    <button className="btn btn--ghost" disabled={!!saving || saved} onClick={() => void save(false)}>
                      <Icon name="bookmark" size={16} /> {saving === 'query' ? 'Guardando…' : 'Guardar consulta'}
                    </button>
                    <button className="btn btn--lime" disabled={!!saving || saved} onClick={() => void save(true)}>
                      <Icon name={saved ? 'check' : 'plus'} size={16} />
                      {saved ? 'Guardado' : saving === 'portfolio' ? 'Agregando…' : 'Agregar al portfolio'}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn--google" onClick={() => void signIn()}>
                    <GoogleMark size={16} /> Continuar con Google
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BenchBar({ label, pct: p, max, muted }: { label: string; pct: number; max: number; muted?: boolean }) {
  const w = max > 0 ? Math.max(4, (Math.abs(p) / max) * 100) : 4;
  return (
    <div className="bench-bar">
      <span className="bench-bar__label">{label}</span>
      <div className="bench-bar__track">
        <span className={`bench-bar__fill bench-bar__fill--${p >= 0 ? 'up' : 'down'}${muted ? ' is-muted' : ''}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`bench-bar__val t-${tone(p)}`}>{signedPct(p)}</span>
    </div>
  );
}
