import { useMemo, useState } from 'react';
import type { MarketSnapshot, Sector } from '../lib/types';
import { SECTORS, SECTOR_COLOR } from '../data/catalog';
import { searchQuotes } from '../components/CedearPicker';
import { int, money, short, signedPct, signedPctShort, tone, usd } from '../lib/format';
import { Card, Empty, Kpi, Skeleton } from '../components/Ui';
import { Icon } from '../components/Icon';
import { PillBars } from '../components/Charts';

type SortKey = 'volumen' | 'suba' | 'baja' | 'precio' | 'az';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'volumen', label: 'Más operados' },
  { id: 'suba', label: 'Mayor suba' },
  { id: 'baja', label: 'Mayor baja' },
  { id: 'precio', label: 'Mayor precio' },
  { id: 'az', label: 'A → Z' },
];

const PAGE = 30;

export function MarketView({
  snapshot,
  error,
  onReload,
  onCalc,
}: {
  snapshot: MarketSnapshot | null;
  error: string | null;
  onReload: () => void;
  onCalc: (symbol: string) => void;
}) {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState<Sector | 'Todos'>('Todos');
  const [sort, setSort] = useState<SortKey>('volumen');
  const [limit, setLimit] = useState(PAGE);

  const quotes = snapshot?.quotes ?? [];
  // En mobile el gráfico por categoría arranca cerrado para que la tabla quede a la vista.
  const [isMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const pickSector = (s: Sector | 'Todos') => {
    setSector((cur) => (cur === s ? 'Todos' : s));
    setLimit(PAGE);
  };

  const counts = useMemo(() => {
    const m = new Map<Sector, number>();
    for (const x of quotes) m.set(x.sector, (m.get(x.sector) ?? 0) + 1);
    return m;
  }, [quotes]);

  const rows = useMemo(() => {
    let r = sector === 'Todos' ? quotes : quotes.filter((x) => x.sector === sector);
    if (q.trim()) r = searchQuotes(r, q, r.length);
    else {
      r = [...r];
      const by: Record<SortKey, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
        volumen: (a, b) => b.volume * b.last - a.volume * a.last,
        suba: (a, b) => b.changePct - a.changePct,
        baja: (a, b) => a.changePct - b.changePct,
        precio: (a, b) => b.last - a.last,
        az: (a, b) => a.symbol.localeCompare(b.symbol),
      };
      r.sort(by[sort]);
    }
    return r;
  }, [quotes, sector, q, sort]);

  const stats = useMemo(() => {
    const up = quotes.filter((x) => x.changePct > 0).length;
    const down = quotes.filter((x) => x.changePct < 0).length;
    const volume = quotes.reduce((s, x) => s + x.volume * x.last, 0);
    const bySector = SECTORS.filter((s) => s !== 'Otros')
      .map((s) => {
        const xs = quotes.filter((x) => x.sector === s && x.volume > 0);
        const avg = xs.length ? xs.reduce((a, x) => a + x.changePct, 0) / xs.length : 0;
        return { label: s, value: avg, n: xs.length };
      })
      .filter((s) => s.n > 0);
    return { up, down, volume, bySector };
  }, [quotes]);

  if (error && !snapshot)
    return (
      <div className="view">
        <Card>
          <Empty icon="info" title="No pudimos traer las cotizaciones">
            <p>{error}</p>
            <button className="btn btn--lime" onClick={onReload}>
              <Icon name="refresh" size={16} /> Reintentar
            </button>
          </Empty>
        </Card>
      </div>
    );

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Mercado de CEDEARs</h1>
          <p className="muted">
            {snapshot ? `${int(quotes.length)} CEDEARs · actualizado ${snapshot.updatedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando…'}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={onReload}>
          <Icon name="refresh" size={16} /> Actualizar
        </button>
      </header>

      <p className="market-summary">
        <span className="t-up">{int(stats.up)} suben</span> · <span className="t-down">{int(stats.down)} bajan</span> · volumen $ {short(stats.volume)}
      </p>

      <div className="kpi-row market-kpis">
        <Kpi featured icon="market" label="CEDEARs listados" value={snapshot ? int(quotes.length) : '—'} foot="en pesos, plazo 24 hs" bars={[4, 6, 5, 7, 6, 8, 9]} />
        <Kpi icon="arrowUp" label="Suben hoy" value={int(stats.up)} delta={quotes.length ? `${Math.round((stats.up / quotes.length) * 100)} %` : undefined} deltaTone="up" foot="del total" />
        <Kpi icon="arrowDown" label="Bajan hoy" value={int(stats.down)} delta={quotes.length ? `${Math.round((stats.down / quotes.length) * 100)} %` : undefined} deltaTone="down" foot="del total" />
        <Kpi icon="flame" label="Volumen operado" value={`$ ${short(stats.volume)}`} foot="en pesos" />
      </div>

      {stats.bySector.length > 0 && (
        <details className="card sector-card" open={!isMobile}>
          <summary className="card__head sector-card__summary">
            <span className="icon-chip">
              <Icon name="pie" size={16} />
            </span>
            <h3>Variación promedio por categoría</h3>
            <span className="card__action muted">Tocá una para filtrar</span>
            <span className="sector-card__chevron" aria-hidden="true">
              <Icon name="chevron" size={16} />
            </span>
          </summary>
          <PillBars
            items={stats.bySector.map((s) => ({ label: s.label, value: s.value, display: signedPctShort(s.value) }))}
            active={sector === 'Todos' ? undefined : sector}
            onSelect={(label) => {
              pickSector(label as Sector);
              document.querySelector('.screener')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </details>
      )}

      <Card className="screener">
        <div className="screener__tools">
          <div className="search">
            <Icon name="search" size={16} />
            <input
              aria-label="Buscar CEDEAR"
              placeholder="Buscar por ticker, empresa o categoría"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
            />
            {q && (
              <button className="icon-btn" aria-label="Limpiar búsqueda" onClick={() => setQ('')}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <label className={`select${sector !== 'Todos' ? ' is-active' : ''}`}>
            <span className="sr-only">Categoría</span>
            <select value={sector} onChange={(e) => pickSector(e.target.value as Sector | 'Todos')}>
              <option value="Todos">Todas ({int(quotes.length)})</option>
              {SECTORS.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
                <option key={s} value={s}>
                  {s} ({counts.get(s)})
                </option>
              ))}
            </select>
          </label>
          <label className="select">
            <span className="sr-only">Ordenar</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} disabled={!!q.trim()}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!snapshot ? (
          <div className="stack">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} h={44} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty icon="search" title="Sin resultados">
            <p>Probá con otro ticker o categoría.</p>
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>CEDEAR</th>
                    <th className="hide-sm">Categoría</th>
                    <th className="num">Precio</th>
                    <th className="num">Var. día</th>
                    <th className="num hide-md">Compra / Venta</th>
                    <th className="num hide-md">USD MEP</th>
                    <th className="num hide-sm">Volumen</th>
                    <th className="hide-xs" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((x) => (
                    <tr key={x.symbol}>
                      <td>
                        <button className="cell-ticker cell-ticker--btn" onClick={() => onCalc(x.symbol)} title="Abrir en la calculadora">
                          <span className="ticker-badge" style={{ ['--c' as string]: SECTOR_COLOR[x.sector] }}>
                            {x.symbol.slice(0, 4)}
                          </span>
                          <span>
                            <b>{x.symbol}</b>
                            <small>{x.name}</small>
                          </span>
                        </button>
                      </td>
                      <td className="hide-sm">
                        <span className="tag" style={{ ['--c' as string]: SECTOR_COLOR[x.sector] }}>
                          {x.sector}
                        </span>
                      </td>
                      <td className="num mono">{money(x.last)}</td>
                      <td className="num">
                        <span className={`delta delta--${tone(x.changePct)}`}>{signedPct(x.changePct)}</span>
                      </td>
                      <td className="num mono hide-md muted">
                        {x.bid ? money(x.bid) : '—'} / {x.ask ? money(x.ask) : '—'}
                      </td>
                      <td className="num mono hide-md">{x.usdMep !== null ? usd(x.usdMep) : '—'}</td>
                      <td className="num mono hide-sm">{short(x.volume)}</td>
                      <td className="num hide-xs">
                        <button className="btn btn--sm btn--ghost" onClick={() => onCalc(x.symbol)}>
                          <Icon name="calc" size={14} /> <span className="hide-sm">Calcular</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > limit && (
              <button className="btn btn--ghost btn--block" onClick={() => setLimit((l) => l + PAGE)}>
                Ver más ({int(rows.length - limit)} restantes)
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
