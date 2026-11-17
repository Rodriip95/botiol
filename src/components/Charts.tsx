import { useId, useMemo, useState } from 'react';
import { dateLabel, money0 } from '../lib/format';

/* ---------- Barras mini (decorativas en las KPI cards) ---------- */

export function MiniBars({ values, highlight = -1 }: { values: number[]; highlight?: number }) {
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div className="mini-bars" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={i === highlight ? 'is-hi' : undefined}
          style={{ height: `${Math.max(12, (Math.abs(v) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/* ---------- Sparkline ---------- */

export function Sparkline({ values, tone = 'up', width = 96, height = 32 }: { values: number[]; tone?: 'up' | 'down' | 'flat'; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - ((v - min) / span) * (height - 6)}`);
  return (
    <svg className={`spark spark--${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Área con tooltip ---------- */

export interface AreaPoint {
  date: string;
  value: number;
}

export function AreaChart({
  data,
  baseline,
  height = 220,
  label = 'Valor',
}: {
  data: AreaPoint[];
  /** Línea horizontal de referencia (ej. lo invertido). */
  baseline?: number;
  height?: number;
  label?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { t: 16, r: 12, b: 26, l: 12 };

  const { path, area, xs, ys, min, max } = useMemo(() => {
    const vals = data.map((d) => d.value);
    if (baseline !== undefined) vals.push(baseline);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const m = (hi - lo) * 0.12 || hi * 0.05 || 1;
    lo -= m;
    hi += m;
    const xs = data.map((_, i) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r));
    const ys = data.map((d) => pad.t + (1 - (d.value - lo) / (hi - lo)) * (H - pad.t - pad.b));
    const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join('');
    const area = `${path}L${xs[xs.length - 1]},${H - pad.b}L${xs[0]},${H - pad.b}Z`;
    return { path, area, xs, ys, min: lo, max: hi };
  }, [data, baseline, H]);

  if (data.length < 2) return <div className="chart-empty">Sin datos históricos suficientes</div>;

  const by = baseline !== undefined ? pad.t + (1 - (baseline - min) / (max - min)) * (H - pad.t - pad.b) : null;
  const last = data[data.length - 1]!;
  const up = baseline === undefined ? last.value >= data[0]!.value : last.value >= baseline;
  const hi = hover !== null ? data[hover] : null;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (data.length - 1)));

  return (
    <div className="area-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: de ${money0(data[0]!.value)} a ${money0(last.value)}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - x) < Math.abs(xs[best]! - x)) best = i;
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={up ? 'var(--lime)' : 'var(--down)'} stopOpacity="0.35" />
            <stop offset="100%" stopColor={up ? 'var(--lime)' : 'var(--down)'} stopOpacity="0" />
          </linearGradient>
          <pattern id={`${id}-p`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H - pad.b} fill={`url(#${id}-p)`} opacity="0.5" />
        <path d={area} fill={`url(#${id}-g)`} />
        {by !== null && (
          <>
            <line x1={pad.l} x2={W - pad.r} y1={by} y2={by} className="area-chart__base" />
            <text x={W - pad.r} y={by - 6} textAnchor="end" className="area-chart__base-label">
              Invertido
            </text>
          </>
        )}
        <path d={path} fill="none" stroke={up ? 'var(--lime)' : 'var(--down)'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <>
            <line x1={xs[hover]} x2={xs[hover]} y1={pad.t} y2={H - pad.b} className="area-chart__cursor" />
            <circle cx={xs[hover]} cy={ys[hover]} r="5" fill="var(--bg)" stroke={up ? 'var(--lime)' : 'var(--down)'} strokeWidth="3" />
          </>
        )}
        {ticks.map((t, i) => (
          <text key={i} x={xs[t]} y={H - 8} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} className="area-chart__tick">
            {dateLabel(data[t]!.date).slice(0, 5)}
            {i === 0 || i === ticks.length - 1 ? `/${data[t]!.date.slice(2, 4)}` : ''}
          </text>
        ))}
      </svg>
      {hi && hover !== null && (
        <div
          className="area-chart__tip"
          style={(() => {
            // En los bordes se ancla a un lado para no salirse de la tarjeta.
            const p = (xs[hover]! / W) * 100;
            const shift = p < 12 ? '0%' : p > 88 ? '-100%' : '-50%';
            return { left: `${p}%`, transform: `translateX(${shift})` };
          })()}
        >
          <strong>{money0(hi.value)}</strong>
          <span>{dateLabel(hi.date)}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Donut ---------- */

export function Donut({
  slices,
  center,
  sub,
}: {
  slices: { label: string; value: number; color: string }[];
  center: string;
  sub?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  const gap = slices.length > 1 ? 6 : 0;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="26" />
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="26"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0.1, len - gap)} ${C}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 100 100)"
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="donut__center">
        <strong>{center}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- Barras verticales tipo "píldora" ---------- */

export function PillBars({
  items,
  active,
  onSelect,
}: {
  items: { label: string; value: number; display: string }[];
  /** Etiqueta seleccionada (resaltada). */
  active?: string;
  /** Si se pasa, cada barra es un botón (ej. filtrar la tabla por categoría). */
  onSelect?: (label: string) => void;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className={`pill-bars${active ? ' has-active' : ''}`}>
      {items.map((it) => {
        const h = Math.max(10, (Math.abs(it.value) / max) * 100);
        const tone = it.value >= 0 ? 'up' : 'down';
        const content = (
          <>
            <span className={`pill-bars__val pill-bars__val--${tone}`}>{it.display}</span>
            <div className="pill-bars__track">
              {/* --pct es alto en columnas (desktop) y ancho en filas (mobile). */}
              <span className={`pill-bars__bar pill-bars__bar--${tone}`} style={{ ['--pct' as string]: `${h}%` }} />
            </div>
            <span className="pill-bars__label">{it.label}</span>
          </>
        );
        const cls = `pill-bars__col${active === it.label ? ' is-active' : ''}`;
        return onSelect ? (
          <button key={it.label} type="button" className={`${cls} pill-bars__col--btn`} aria-pressed={active === it.label} onClick={() => onSelect(it.label)}>
            {content}
          </button>
        ) : (
          <div key={it.label} className={cls}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
