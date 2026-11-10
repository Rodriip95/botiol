import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_INSTRUMENTS, type Quote, type TradePlan } from '@bot-iol/shared';
import { fetchQuote } from './api';
import { Journal } from './Journal';
import { Planner } from './Planner';

type QuoteState = { status: 'loading' } | { status: 'ok'; quote: Quote } | { status: 'error'; message: string };

const fmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function QuoteCard({ symbol }: { symbol: string }) {
  const [state, setState] = useState<QuoteState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    fetchQuote(symbol)
      .then((quote) => setState({ status: 'ok', quote }))
      .catch((err: unknown) => setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, [symbol]);

  useEffect(load, [load]);

  return (
    <article className="card">
      <header>
        <h2>{symbol}</h2>
        <button onClick={load} disabled={state.status === 'loading'}>
          Actualizar
        </button>
      </header>
      {state.status === 'loading' && <p className="muted">Cargando…</p>}
      {state.status === 'error' && <p className="error">{state.message}</p>}
      {state.status === 'ok' && (
        <>
          <p className="price">$ {fmt.format(state.quote.last)}</p>
          <p className={state.quote.changePct >= 0 ? 'up' : 'down'}>
            {state.quote.changePct >= 0 ? '+' : ''}
            {fmt.format(state.quote.changePct)}%
          </p>
          <dl>
            <dt>Apertura</dt>
            <dd>{fmt.format(state.quote.open)}</dd>
            <dt>Máx / Mín</dt>
            <dd>
              {fmt.format(state.quote.high)} / {fmt.format(state.quote.low)}
            </dd>
            <dt>Compra / Venta</dt>
            <dd>
              {state.quote.bid ? fmt.format(state.quote.bid) : '–'} / {state.quote.ask ? fmt.format(state.quote.ask) : '–'}
            </dd>
            <dt>Hora</dt>
            <dd>{new Date(state.quote.timestamp).toLocaleTimeString('es-AR')}</dd>
          </dl>
        </>
      )}
    </article>
  );
}

export function App() {
  const [plan, setPlan] = useState<TradePlan | null>(null);
  const onPlan = useCallback((p: TradePlan) => setPlan(p), []);
  return (
    <main>
      <h1>Bot IOL</h1>
      <p className="muted">Cotizaciones de CEDEARs en BCBA, vía el backend local.</p>
      <section className="grid">
        {DEFAULT_INSTRUMENTS.map((i) => (
          <QuoteCard key={i.symbol} symbol={i.symbol} />
        ))}
      </section>
      <section className="stack">
        <Planner onPlan={onPlan} />
        <Journal plan={plan} />
      </section>
      <p className="muted small">Herramienta de cálculo personal. No es asesoramiento financiero.</p>
    </main>
  );
}
