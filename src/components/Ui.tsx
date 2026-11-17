import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { MiniBars } from './Charts';

export function Card({ title, icon, action, className = '', children }: { title?: string; icon?: IconName; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card__head">
          {icon && (
            <span className="icon-chip">
              <Icon name={icon} size={16} />
            </span>
          )}
          <h3>{title}</h3>
          {action && <div className="card__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  icon,
  delta,
  deltaTone = 'flat',
  foot,
  bars,
  featured,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
  foot?: string;
  bars?: number[];
  featured?: boolean;
}) {
  return (
    <article className={`kpi${featured ? ' kpi--featured' : ''}`}>
      <header className="kpi__head">
        <span className="icon-chip icon-chip--round">
          <Icon name={icon} size={16} />
        </span>
        <span className="kpi__label">{label}</span>
      </header>
      <div className="kpi__body">
        <div>
          {/* --chars: la fuente se achica con montos largos para no cortarlos con "…" en pantallas chicas. */}
          <strong className="kpi__value" title={value} style={{ ['--chars' as string]: value.length }}>
            {value}
          </strong>
          {(delta || foot) && (
            <p className="kpi__foot">
              {delta && <span className={`delta delta--${deltaTone}`}>{delta}</span>}
              {foot && <span>{foot}</span>}
            </p>
          )}
        </div>
        {bars && <MiniBars values={bars} highlight={bars.length - 1} />}
      </div>
    </article>
  );
}

export function Skeleton({ h = 18, w = '100%' }: { h?: number; w?: number | string }) {
  return <span className="skeleton" style={{ height: h, width: w }} />;
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <h4>{title}</h4>
      {children}
    </div>
  );
}
