import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  PAST_TRADES,
  summarizeJournal,
  winsToRecover,
  type ClosedTrade,
  type TradePlan,
  type TradeSource,
} from '@bot-iol/shared';
import { money, pct, signedMoney } from './format';
import { loadList, save } from './storage';

const KEY = 'bot-iol.journal.v1';

interface Draft {
  symbol: string;
  source: TradeSource;
  quantity: string;
  invested: string;
  proceeds: string;
  closedAt: string;
}

const emptyDraft = (): Draft => ({
  symbol: 'NVDA',
  source: 'simulada',
  quantity: '',
  invested: '',
  proceeds: '',
  closedAt: new Date().toISOString().slice(0, 10),
});

export function Journal({ plan }: { plan: TradePlan | null }) {
  const [own, setOwn] = useState<ClosedTrade[]>(() => loadList<ClosedTrade>(KEY));
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => save(KEY, own), [own]);

  const summary = useMemo(() => summarizeJournal([...PAST_TRADES, ...own]), [own]);
  const loss = -Math.min(0, summary.totalPnl);
  const gainPerWin = plan?.ok ? plan.gainAtTarget : 0;
  const wins = winsToRecover(loss, gainPerWin);

  function add(e: FormEvent) {
    e.preventDefault();
    const quantity = Number(draft.quantity);
    const invested = Number(draft.invested);
    const proceeds = Number(draft.proceeds);
    if (!draft.symbol || !(quantity > 0) || !(invested > 0) || !(proceeds >= 0)) return;
    setOwn((prev) => [
      ...prev,
      {
        id: `${draft.source}-${Date.now()}`,
        symbol: draft.symbol.toUpperCase(),
        source: draft.source,
        quantity,
        invested,
        proceeds,
        closedAt: draft.closedAt || undefined,
      },
    ]);
    setDraft(emptyDraft());
  }

  return (
    <article className="card wide">
      <header>
        <h2>Registro y P&amp;L acumulado</h2>
      </header>

      <div className="stats">
        <div>
          <span className="muted small">P&amp;L acumulado</span>
          <strong className={summary.totalPnl < 0 ? 'down' : 'up'}>{signedMoney(summary.totalPnl)}</strong>
        </div>
        <div>
          <span className="muted small">Ganadoras / perdedoras</span>
          <strong>
            {summary.wins} / {summary.losses}
          </strong>
        </div>
        <div>
          <span className="muted small">Total invertido</span>
          <strong>{money(summary.totalInvested)}</strong>
        </div>
      </div>

      {loss > 0 && (
        <p className="callout">
          {gainPerWin > 0 ? (
            <>
              Con el plan actual, cada operación que llegue al take profit gana {money(gainPerWin)}. Recuperar{' '}
              {money(loss)} lleva <strong>al menos {wins} operaciones ganadoras</strong>, sin contar las que salgan mal.
              Es un proceso de meses, no de un jueves: no subas el riesgo para acelerarlo.
            </>
          ) : (
            <>Cuando el planificador dé un plan válido, acá vas a ver cuántas ganadoras hacen falta para recuperar {money(loss)}.</>
          )}
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>CEDEAR</th>
              <th>Tipo</th>
              <th className="num">Cant.</th>
              <th className="num">Invertido</th>
              <th className="num">Cobrado</th>
              <th className="num">P&amp;L</th>
              <th className="num">Acumulado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summary.trades.map((t) => (
              <tr key={t.id} title={t.note}>
                <td>{t.closedAt ?? '–'}</td>
                <td>{t.symbol}</td>
                <td>{t.source}</td>
                <td className="num">{t.quantity}</td>
                <td className="num">{money(t.invested)}</td>
                <td className="num">{money(t.proceeds)}</td>
                <td className={`num ${t.pnl < 0 ? 'down' : 'up'}`}>
                  {signedMoney(t.pnl)} ({pct(t.pnlPct)})
                </td>
                <td className={`num ${t.cumulativePnl < 0 ? 'down' : 'up'}`}>{signedMoney(t.cumulativePnl)}</td>
                <td>
                  {own.some((o) => o.id === t.id) && (
                    <button onClick={() => setOwn((prev) => prev.filter((o) => o.id !== t.id))} aria-label="Borrar">
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="form" onSubmit={add}>
        <label>
          CEDEAR
          <input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} maxLength={12} />
        </label>
        <label>
          Tipo
          <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as TradeSource })}>
            <option value="simulada">simulada</option>
            <option value="real">real</option>
          </select>
        </label>
        <label>
          Cantidad
          <input type="number" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
        </label>
        <label>
          Invertido, con costos ($)
          <input type="number" value={draft.invested} onChange={(e) => setDraft({ ...draft, invested: e.target.value })} />
        </label>
        <label>
          Cobrado, neto de costos ($)
          <input type="number" value={draft.proceeds} onChange={(e) => setDraft({ ...draft, proceeds: e.target.value })} />
        </label>
        <label>
          Fecha de cierre
          <input type="date" value={draft.closedAt} onChange={(e) => setDraft({ ...draft, closedAt: e.target.value })} />
        </label>
        <button type="submit">Registrar operación cerrada</button>
      </form>
      <p className="muted small">
        Las tres primeras filas son tus ventas reales (capturas de IOL). Lo que agregues se guarda en este navegador
        hasta que el bot tenga base de datos.
      </p>
    </article>
  );
}
