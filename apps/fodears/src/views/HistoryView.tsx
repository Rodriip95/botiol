import { useState } from 'react';
import type { CedearQuote, SavedEntry } from '../lib/types';
import { SECTOR_COLOR } from '../data/catalog';
import { entriesRepo } from '../data/entries';
import { useAuth } from '../auth/AuthContext';
import { dateLabel, int, money, money0, signedMoney, signedPct, tone } from '../lib/format';
import { Card, Empty } from '../components/Ui';
import { Icon } from '../components/Icon';
import { LoginGate } from './PortfolioView';

type Filter = 'todas' | 'portfolio' | 'consultas';

export function HistoryView({
  entries,
  bySymbol,
  onCalc,
  onToast,
}: {
  entries: SavedEntry[];
  bySymbol: ReadonlyMap<string, CedearQuote>;
  onCalc: (symbol: string, entry?: SavedEntry) => void;
  onToast: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('todas');
  const [confirm, setConfirm] = useState<string | null>(null);

  if (!user)
    return <LoginGate title="Guardá tus consultas" text="Ingresá con Google y cada cálculo que guardes queda acá, actualizado con el precio de hoy." />;

  const rows = entries.filter((e) => (filter === 'todas' ? true : filter === 'portfolio' ? e.inPortfolio : !e.inPortfolio));

  const toggle = async (e: SavedEntry) => {
    try {
      await entriesRepo.update(user.uid, e.id, { inPortfolio: !e.inPortfolio });
      onToast(e.inPortfolio ? `${e.symbol} salió del portfolio` : `${e.symbol} agregado al portfolio`);
    } catch {
      onToast('No pudimos actualizar la consulta');
    }
  };
  const remove = async (e: SavedEntry) => {
    try {
      await entriesRepo.remove(user.uid, e.id);
      setConfirm(null);
      onToast('Consulta eliminada');
    } catch {
      onToast('No pudimos eliminar la consulta');
    }
  };

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Historial de consultas</h1>
          <p className="muted">{entries.length} consultas guardadas · valorizadas al precio de hoy</p>
        </div>
        <div className="segmented" role="tablist">
          {(['todas', 'portfolio', 'consultas'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'is-active' : undefined} onClick={() => setFilter(f)}>
              {f === 'todas' ? 'Todas' : f === 'portfolio' ? 'En portfolio' : 'Solo consultas'}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <Card>
          <Empty icon="history" title="Nada por acá todavía">
            <p>Guardá una consulta desde la calculadora.</p>
          </Empty>
        </Card>
      ) : (
        <div className="history-grid">
          {rows.map((e) => {
            const q = bySymbol.get(e.symbol);
            const value = q ? q.last * e.quantity : null;
            const pnl = value !== null ? value - e.invested : null;
            const pnlPct = pnl !== null ? (pnl / e.invested) * 100 : null;
            const sector = q?.sector ?? 'Otros';
            return (
              <article key={e.id} className={`entry${e.inPortfolio ? ' entry--pf' : ''}`}>
                <header className="entry__head">
                  <span className="ticker-badge" style={{ ['--c' as string]: SECTOR_COLOR[sector] }}>
                    {e.symbol.slice(0, 4)}
                  </span>
                  <div>
                    <b>{e.symbol}</b>
                    <small>{q?.name ?? e.symbol}</small>
                  </div>
                  {e.inPortfolio && <span className="tag tag--lime">Portfolio</span>}
                </header>
                <div className="entry__pnl">
                  <strong className={`t-${tone(pnl ?? 0)}`}>{pnl !== null ? signedMoney(pnl) : '—'}</strong>
                  {pnlPct !== null && <span className={`delta delta--${tone(pnlPct)}`}>{signedPct(pnlPct)}</span>}
                </div>
                <dl className="entry__dl">
                  <div>
                    <dt>Nominales</dt>
                    <dd>{int(e.quantity)}</dd>
                  </div>
                  <div>
                    <dt>Invertido</dt>
                    <dd>{money0(e.invested)}</dd>
                  </div>
                  <div>
                    <dt>Valor hoy</dt>
                    <dd>{value !== null ? money0(value) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Compra</dt>
                    <dd>{e.date ? dateLabel(e.date) : 'sin fecha'}</dd>
                  </div>
                </dl>
                <p className="entry__then muted small">
                  Al guardar: {money(e.snapshot.price)} c/u ·{' '}
                  <span className={`t-${tone(e.snapshot.pnl)}`}>{signedPct(e.snapshot.pnlPct)}</span> ·{' '}
                  {new Date(e.createdAt).toLocaleDateString('es-AR')}
                </p>
                <footer className="entry__actions">
                  <button className="btn btn--sm btn--ghost" onClick={() => onCalc(e.symbol, e)}>
                    <Icon name="calc" size={14} /> Recalcular
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => void toggle(e)}>
                    <Icon name={e.inPortfolio ? 'close' : 'plus'} size={14} /> {e.inPortfolio ? 'Quitar' : 'Al portfolio'}
                  </button>
                  {confirm === e.id ? (
                    <button className="btn btn--sm btn--danger" onClick={() => void remove(e)}>
                      ¿Eliminar?
                    </button>
                  ) : (
                    <button className="icon-btn" aria-label={`Eliminar consulta de ${e.symbol}`} onClick={() => setConfirm(e.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
