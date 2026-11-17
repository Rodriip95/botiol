import { useMemo } from 'react';
import type { CedearQuote, SavedEntry } from '../lib/types';
import { BENCHMARK, CATALOG_BY_SYMBOL, SECTOR_COLOR } from '../data/catalog';
import { useHistories } from '../data/hooks';
import { aggregateHoldings, closeAt } from '../lib/pnl';
import { int, money, money0, pct, signedMoney, signedMoney0, signedPct, signedPctShort, tone, usd } from '../lib/format';
import { AreaChart, Donut, PillBars } from '../components/Charts';
import { Card, Empty, Kpi, Skeleton } from '../components/Ui';
import { GoogleMark, Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export function LoginGate({ title, text }: { title: string; text: string }) {
  const { signIn, mode } = useAuth();
  return (
    <div className="view">
      <section className="gate">
        <span className="gate__glow" aria-hidden="true" />
        <span className="icon-chip icon-chip--xl">
          <Icon name="pie" size={26} />
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
        <button className="btn btn--google btn--lg" onClick={() => void signIn()}>
          <GoogleMark size={18} /> Continuar con Google
        </button>
        {mode === 'demo' && <p className="muted small">Modo demo: Firebase no está configurado, se usa una cuenta de ejemplo local.</p>}
      </section>
    </div>
  );
}

export function PortfolioView({
  entries,
  bySymbol,
  mep,
  onCalc,
}: {
  entries: SavedEntry[];
  bySymbol: ReadonlyMap<string, CedearQuote>;
  mep: number | null;
  onCalc: (symbol: string) => void;
}) {
  const { user } = useAuth();
  const positions = useMemo(() => entries.filter((e) => e.inPortfolio), [entries]);
  const agg = useMemo(() => aggregateHoldings(positions, bySymbol), [positions, bySymbol]);

  const symbols = useMemo(() => [...new Set([...agg.holdings.map((h) => h.symbol), BENCHMARK])].sort(), [agg.holdings]);
  const hist = useHistories(user && positions.length ? symbols : []);

  /** Lo mismo invertido en SPY en cada fecha de compra. */
  const bench = useMemo(() => {
    const spy = hist.data.get(BENCHMARK);
    const spyNow = bySymbol.get(BENCHMARK)?.last;
    if (!spy?.length || !spyNow) return null;
    let invested = 0;
    let mine = 0;
    let theirs = 0;
    let n = 0;
    for (const e of positions) {
      if (!e.date) continue;
      const c = closeAt(spy, e.date);
      const q = bySymbol.get(e.symbol);
      if (!c || !q) continue;
      invested += e.invested;
      mine += e.quantity * q.last;
      theirs += e.invested * (spyNow / c.close);
      n++;
    }
    if (!n) return null;
    return { invested, mine, theirs, minePct: (mine / invested - 1) * 100, theirsPct: (theirs / invested - 1) * 100, n };
  }, [hist.data, positions, bySymbol]);

  /** Valor de las posiciones actuales en los últimos 6 meses (como si las hubieras tenido siempre). */
  const series = useMemo(() => {
    if (!agg.holdings.length) return [];
    const from = new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10);
    const base = hist.data.get(agg.holdings[0]!.symbol) ?? [];
    const dates = base.filter((c) => c.date >= from).map((c) => c.date);
    return dates.map((date) => ({
      date,
      value: agg.holdings.reduce((s, h) => {
        const c = closeAt(hist.data.get(h.symbol) ?? [], date);
        return s + (c ? c.close : h.price) * h.quantity;
      }, 0),
    }));
  }, [agg.holdings, hist.data]);

  const sectors = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of agg.holdings) {
      const s = bySymbol.get(h.symbol)?.sector ?? CATALOG_BY_SYMBOL.get(h.symbol)?.sector ?? 'Otros';
      m.set(s, (m.get(s) ?? 0) + h.value);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [agg.holdings, bySymbol]);

  if (!user)
    return (
      <LoginGate
        title="Armá tu portfolio de CEDEARs"
        text="Ingresá con Google para guardar tus compras, ver cuánto vale todo hoy y compararlo contra el mercado."
      />
    );

  if (!positions.length)
    return (
      <div className="view">
        <Card>
          <Empty icon="pie" title="Tu portfolio está vacío">
            <p>Calculá una compra y tocá “Agregar al portfolio”.</p>
            <button className="btn btn--lime" onClick={() => onCalc('')}>
              <Icon name="calc" size={16} /> Ir a la calculadora
            </button>
          </Empty>
        </Card>
      </div>
    );

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Mi portfolio</h1>
          <p className="muted">
            {agg.holdings.length} CEDEARs · {positions.length} compras registradas
          </p>
        </div>
      </header>

      <div className="kpi-row">
        <Kpi
          featured
          icon="wallet"
          label="Valor total"
          value={money(agg.value)}
          foot={mep ? `≈ ${usd(agg.value / mep)}` : undefined}
          bars={series.filter((_, i) => i % 12 === 0).map((p) => p.value).slice(-9)}
        />
        <Kpi icon="calc" label="Invertido" value={money(agg.invested)} foot="costo total" />
        <Kpi
          icon={agg.pnl >= 0 ? 'arrowUp' : 'arrowDown'}
          label="Resultado"
          value={signedMoney(agg.pnl)}
          delta={signedPct(agg.pnlPct)}
          deltaTone={tone(agg.pnl)}
          foot="desde la compra"
        />
        <Kpi icon="flame" label="Hoy" value={signedMoney(agg.dayPnl)} delta={signedPct(agg.value ? (agg.dayPnl / (agg.value - agg.dayPnl)) * 100 : 0)} deltaTone={tone(agg.dayPnl)} foot="variación del día" />
      </div>

      <div className="pf-grid">
        <Card title="Evolución (últimos 6 meses)" icon="market" className="pf-chart">
          {hist.loading && !series.length ? <Skeleton h={220} /> : <AreaChart data={series} />}
          <p className="muted small">Valor de tus tenencias actuales con los cierres de cada día.</p>
        </Card>

        <Card title="Por categoría" icon="pie" className="pf-donut">
          <div className="donut-wrap">
            <Donut
              slices={sectors.map(([label, value]) => ({ label, value, color: SECTOR_COLOR[label as keyof typeof SECTOR_COLOR] ?? '#888' }))}
              center={`${agg.holdings.length}`}
              sub="CEDEARs"
            />
            <ul className="legend">
              {sectors.map(([label, value]) => (
                <li key={label}>
                  <span className="legend__dot" style={{ background: SECTOR_COLOR[label as keyof typeof SECTOR_COLOR] }} />
                  <span>{label}</span>
                  <b>{pct((value / agg.value) * 100)}</b>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title={`Contra el mercado (${BENCHMARK})`} icon="star" className="pf-bench">
          {hist.loading && !bench ? (
            <Skeleton h={120} />
          ) : bench ? (
            <div className="vs">
              <div className="vs__col">
                <span className="muted small">Tus compras</span>
                <strong className={`t-${tone(bench.minePct)}`}>{signedPct(bench.minePct)}</strong>
                <span className="mono">{money0(bench.mine)}</span>
              </div>
              <span className="vs__sep">vs</span>
              <div className="vs__col">
                <span className="muted small">Mismo dinero en {BENCHMARK}</span>
                <strong className={`t-${tone(bench.theirsPct)}`}>{signedPct(bench.theirsPct)}</strong>
                <span className="mono">{money0(bench.theirs)}</span>
              </div>
              <p className={`vs__verdict t-${tone(bench.minePct - bench.theirsPct)}`}>
                {bench.minePct >= bench.theirsPct ? 'Le estás ganando al mercado' : 'El mercado te va ganando'} por{' '}
                <b>{pct(Math.abs(bench.minePct - bench.theirsPct))}</b> puntos
              </p>
              <p className="muted small">Sobre {bench.n} compras con fecha cargada.</p>
            </div>
          ) : (
            <Empty icon="calendar" title="Cargá fechas de compra">
              <p>Para comparar contra el {BENCHMARK} necesitamos la fecha de cada compra.</p>
            </Empty>
          )}
        </Card>

        <Card title="Resultado por CEDEAR" icon="target" className="pf-bars">
          <PillBars
            items={agg.holdings.slice(0, 8).map((h) => ({ label: h.symbol, value: h.pnlPct, display: signedPctShort(h.pnlPct) }))}
          />
        </Card>
      </div>

      <Card title="Tenencias" icon="wallet">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>CEDEAR</th>
                <th className="num hide-sm">Nominales</th>
                <th className="num hide-sm">Precio prom.</th>
                <th className="num hide-sm">Precio actual</th>
                <th className="num">Valor</th>
                <th className="num">Resultado</th>
                <th className="num hide-md">Peso</th>
                <th className="num hide-md">Hoy</th>
              </tr>
            </thead>
            <tbody>
              {agg.holdings.map((h) => {
                const q = bySymbol.get(h.symbol);
                const sector = q?.sector ?? 'Otros';
                return (
                  <tr key={h.symbol}>
                    <td>
                      <button className="cell-ticker cell-ticker--btn" onClick={() => onCalc(h.symbol)} title="Abrir en la calculadora">
                        <span className="ticker-badge" style={{ ['--c' as string]: SECTOR_COLOR[sector] }}>
                          {h.symbol.slice(0, 4)}
                        </span>
                        <span>
                          <b>{h.symbol}</b>
                          <small>{q?.name ?? h.symbol}</small>
                        </span>
                      </button>
                    </td>
                    <td className="num mono hide-sm">{int(h.quantity)}</td>
                    <td className="num mono hide-sm">{money(h.avgCost)}</td>
                    <td className="num mono hide-sm">{money(h.price)}</td>
                    <td className="num mono">{money0(h.value)}</td>
                    <td className="num">
                      <span className={`delta delta--${tone(h.pnl)}`}>{signedPct(h.pnlPct)}</span>
                      <small className={`block mono t-${tone(h.pnl)}`}>{signedMoney0(h.pnl)}</small>
                    </td>
                    <td className="num hide-md">
                      <div className="weight">
                        <span style={{ width: `${h.weightPct}%`, background: SECTOR_COLOR[sector] }} />
                      </div>
                      <small className="mono">{pct(h.weightPct)}</small>
                    </td>
                    <td className="num hide-md">
                      <span className={`t-${tone(h.changePct)} mono`}>{signedPct(h.changePct)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
