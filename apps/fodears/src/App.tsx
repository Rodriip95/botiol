import { useCallback, useEffect, useRef, useState } from 'react';
import { useEntries, useMarket } from './data/hooks';
import type { SavedEntry } from './lib/types';
import { Shell, type Route } from './components/Shell';
import { CalculatorView, type CalcPreset } from './views/CalculatorView';
import { MarketView } from './views/MarketView';
import { PortfolioView } from './views/PortfolioView';
import { HistoryView } from './views/HistoryView';
import { Icon } from './components/Icon';
import { amountInput } from './lib/format';

const isErrorMsg = (msg: string) => /^(error|no pudimos)/i.test(msg);

const ROUTES: Route[] =['calc', 'mercado', 'portfolio', 'historial'];
const routeFromHash = (): Route => {
  const h = window.location.hash.replace('#/', '').replace('#', '') as Route;
  return ROUTES.includes(h) ? h : 'calc';
};

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const { snapshot, bySymbol, error, reload } = useMarket();
  const { entries, error: entriesError } = useEntries();
  const [preset, setPreset] = useState<CalcPreset | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Atajo "/" para enfocar el buscador global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.picker--top input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback((r: Route) => {
    window.location.hash = `/${r}`;
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    if (entriesError) showToast(`Error al leer tus datos: ${entriesError}`);
  }, [entriesError, showToast]);

  const openCalc = useCallback(
    (symbol: string, entry?: SavedEntry) => {
      setPreset((p) => ({
        n: (p?.n ?? 0) + 1,
        full: !!entry,
        form: entry
          ? { symbol: entry.symbol, quantity: String(entry.quantity), invested: amountInput(entry.invested), date: entry.date ?? '' }
          : { symbol },
      }));
      go('calc');
    },
    [go],
  );

  return (
    <Shell route={route} onRoute={go} quotes={snapshot?.quotes ?? []} snapshot={snapshot} onQuickPick={(s) => openCalc(s)}>
      {error && snapshot === null && route !== 'mercado' && (
        <p className="banner banner--error" role="alert">
          <Icon name="info" size={16} /> No pudimos traer las cotizaciones ({error}).{' '}
          <button className="link" onClick={() => void reload()}>
            Reintentar
          </button>
        </p>
      )}
      {route === 'calc' && <CalculatorView snapshot={snapshot} bySymbol={bySymbol} presetSymbol={preset} onToast={showToast} />}
      {route === 'mercado' && <MarketView snapshot={snapshot} error={error} onReload={() => void reload()} onCalc={openCalc} />}
      {route === 'portfolio' && <PortfolioView entries={entries} bySymbol={bySymbol} mep={snapshot?.mep ?? null} onCalc={openCalc} />}
      {route === 'historial' && <HistoryView entries={entries} bySymbol={bySymbol} onCalc={openCalc} onToast={showToast} />}
      <div className={`toast${toast ? ' is-on' : ''}${toast && isErrorMsg(toast) ? ' toast--error' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            <Icon name={isErrorMsg(toast) ? 'info' : 'check'} size={16} /> {toast}
          </>
        )}
      </div>
    </Shell>
  );
}
